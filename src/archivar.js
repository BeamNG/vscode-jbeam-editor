/*
  This JavaScript file is part of a Visual Studio Code (VSCode) extension
  designed for working with JBEAM files used in the video game "BeamNG.drive."

  File Overview:
  - It defines functions to parse and process JBEAM files.
  - Maintains data related to JBEAM files and their parts.
  - Handles file changes within a workspace.

*/
const vscode = require('vscode');

const sjsonParser = require('./json/sjsonParser');
const tableSchema = require('./json/tableSchema');
const path = require('path')
const fs = require('fs');
const utilsExt = require('./utilsExt');

let jbeamFileData = {} // the root that holds all data
let partData = {}
let rootPath
let jbeamFileCounter = 0
let partCounter = 0

const archivarDiagnostics = vscode.languages.createDiagnosticCollection('archivar');
const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

function fileExists(filePath) {
  try {
    // Check if the file exists by attempting to access its stats
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    // File does not exist or other error occurred
    return false;
  }
}

function processJbeamFile(filename) {
  if(!fileExists(filename)) return
  const namespace = utilsExt.getNamespaceFromFilename(rootPath, filename)
  let diagnosticsList = []
  jbeamFileCounter++
  const contentTextUtf8 = fs.readFileSync(filename, 'utf8');
  if(contentTextUtf8) {
    let dataBundle
    try {
      dataBundle = sjsonParser.decodeWithMeta(contentTextUtf8, filename)
      if(dataBundle.errors.length > 0) {
        for(let e of dataBundle.errors) {
          const pos = new vscode.Position(
            e.range ? e.range[0] : e.line ? e.line : 0,
            e.range ? e.range[1] : e.column ? e.column : 0
          )
          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(pos, pos),
            `Error parsing json file ${filename}`,
            vscode.DiagnosticSeverity.Error
          );
          diagnosticsList.push(diagnostic);
        }

        //console.error(`Error parsing json file ${filename} - ${JSON.stringify(dataBundle.errors, null, 2)}`)
      }
    } catch (e) {
      const pos = new vscode.Position(0, 0)
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(pos, pos),
        `Error parsing json file ${filename}. Exception: ${e.message}`,
        vscode.DiagnosticSeverity.Error
      );
      diagnosticsList.push(diagnostic);
    }
    if(dataBundle) {
      if(!jbeamFileData[namespace]) {
        jbeamFileData[namespace] = {}
      }
      jbeamFileData[namespace][filename] = dataBundle
      //console.log(`${filename} [${namespace}] contains ${Object.keys(dataBundle.data).length} parts ...`);


      let partNames = Object.keys(dataBundle.data).filter(key => key !== '__meta')
      for(let partName of partNames) {
        const part = dataBundle.data[partName]
        part.__meta.origin = filename
        if(!partData[namespace]) {
          partData[namespace] = {}
        }
        partData[namespace][partName] = part
        partCounter++
      }
    } else {
      console.error(`Unable to read file: ${filename}`)
    }
  } else {
    const pos = new vscode.Position(0, 0)
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(pos, pos),
      `Error parsing json file ${filename}`,
      vscode.DiagnosticSeverity.Error
    );
    diagnosticsList.push(diagnostic);
  }
  archivarDiagnostics.set(vscode.Uri.file(filename), diagnosticsList);
  return true
}

function removeJbeamFileData(filename) {
  const namespace = utilsExt.getNamespaceFromFilename(rootPath, filename)
  if (!jbeamFileData || !jbeamFileData[namespace] || !jbeamFileData[namespace][filename]) {
    return
  }
  for(let partName in jbeamFileData[namespace][filename]) {
    if(partData[namespace][partName]) {
      delete(partData[namespace][partName])
      partCounter--
    }
  }
  delete(jbeamFileData[namespace][filename])
  //console.log(`Deleted ${deletedParts} parts from file ${filename}`)
}

let fileDebounceMap = new Map()
const debounceTime = 50 // milliseconds

function onFileChangedDebounced(filename) {
  //console.log('onFileChanged', changeType, filename)
  if(path.extname(filename) == '.jbeam') {
    removeJbeamFileData(filename)
    processJbeamFile(filename)
    //console.log(`Part count diff after updating file: ${partCounter}: ${filename}`)
    statusBar.text = `$(project) ${jbeamFileCounter} JBeam files $(repo) ${partCounter} parts`
  }
}

// onFileChanged will be called many times for any file change, we need to debounce the request and only call the file change function once.
function onFileChanged(changeType, filename) {
  if(!rootPath || !filename) return
  filename = path.join(rootPath, filename)
  if (fileDebounceMap.has(filename)) {
    clearTimeout(fileDebounceMap.get(filename))
    //console.log('onFileChanged - BOUNCED!', changeType, filename)
  }
  fileDebounceMap.set(filename, setTimeout(() => {
    // do not use changeType in here as we accumulate events with the bouncing!
    onFileChangedDebounced(filename)
    fileDebounceMap.delete(filename)
  }, debounceTime));
}

function loadJbeamFiles() {
  statusBar.text = `Parsing jbeam files ...`
  statusBar.show()

  rootPath = utilsExt.getRootpath()
  if (!rootPath) {
    console.error('unable to load jbeam: not in a workspace')
    statusBar.hide()
    return
  }

  const vehiclesPath = vscode.Uri.file(path.join(rootPath, '/vehicles/')).fsPath
  jbeamFileCounter = 0
  partCounter = 0

  let findFilesPromises = []
  // Find .jbeam files
  findFilesPromises.push(vscode.workspace.findFiles(new vscode.RelativePattern(vehiclesPath, '**/*.jbeam'), null).then(files => {
    statusBar.text = `Parsing ${files.length} jbeam files ...`
    for(let file of files) {
      jbeamFileCounter++
      processJbeamFile(file.fsPath)
    }
  }));
  Promise.all(findFilesPromises).then(allFilesArrays => {
    statusBar.text = `$(project) ${jbeamFileCounter} JBeam files $(repo) ${partCounter} parts`

    //for(let namespace in partData) {
    //  console.log(` * ${namespace} - ${Object.keys(partData[namespace]).length} parts`)
    //}
  })

  // now watch for changes
  fs.watch(rootPath, {recursive: true}, onFileChanged)
}

function activate(context) {
  loadJbeamFiles()
}

function deactivate() {
}

module.exports = {
  activate,
  deactivate,
  partData,
}
