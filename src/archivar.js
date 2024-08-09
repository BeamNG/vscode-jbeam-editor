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
const syntaxChecker = require('./jbeam/syntaxChecker');
const path = require('path')
const fs = require('fs');
const os = require('os');
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
  const contentTextUtf8 = fs.readFileSync(filename, 'utf8');
  if(contentTextUtf8) {
    let dataBundle
    try {
      dataBundle = sjsonParser.decodeWithMetaWithDiagnostics(contentTextUtf8, filename, false)
      if(dataBundle) {
        diagnosticsList.push(...dataBundle.diagnosticsList)
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
    if(dataBundle && !dataBundle.errorsExist) {
      if(!jbeamFileData[namespace]) {
        jbeamFileData[namespace] = {}
      }

      let [tableInterpretedData, diagnosticsTable] = tableSchema.processAllParts(dataBundle.data)
      for (const w of diagnosticsTable) {
        // w[0] = type: error/warning
        // w[1] = message
        // w[2] = range = [linefrom, positionfrom, lineto, positionto]
        let linefrom = 0, positionfrom = 0, lineto = 0, positionto = 0
        if (w[2]) {
          linefrom = w[2][0], positionfrom = w[2][1], lineto = w[2][2], positionto = w[2][3]
        }
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(new vscode.Position(linefrom, positionfrom), new vscode.Position(lineto, positionto)),
          w[1],
          w[0] == 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error
        );
        diagnosticsList.push(diagnostic);
      }

      dataBundle.tableInterpretedData = tableInterpretedData

      jbeamFileData[namespace][filename] = dataBundle
      jbeamFileCounter++
      //console.log(`${filename} [${namespace}] contains ${Object.keys(dataBundle.data).length} parts ...`);


      let partNames = Object.keys(dataBundle.data).filter(key => key !== '__meta')
      for(let partName of partNames) {
        const partRaw = dataBundle.data[partName]
        if(typeof partRaw?.__meta === "object") {
          partRaw.__meta.origin = filename
        }
        const partInterpreted = dataBundle.tableInterpretedData[partName]
        if(typeof partInterpreted?.__meta === "object") {
          partInterpreted.__meta.origin = filename
        }
        if(!partData[namespace]) {
          partData[namespace] = {}
        }
        partData[namespace][partName] = { 'raw': partRaw, 'interpreted': partInterpreted}
        partCounter++
      }
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
  syntaxChecker.jbeamDiagnostics.set(vscode.Uri.file(filename), diagnosticsList);
  return true
}

function removeJbeamFileData(filename) {
  const namespace = utilsExt.getNamespaceFromFilename(rootPath, filename)
  if (!jbeamFileData || !jbeamFileData[namespace] || !jbeamFileData[namespace][filename]) {
    return
  }
  for(let partName in jbeamFileData[namespace][filename].data) {
    if(partData[namespace][partName]) {
      delete(partData[namespace][partName])
      partCounter--
    }
  }
  delete(jbeamFileData[namespace][filename])
  jbeamFileCounter--
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
  const isLinux = os.platform() === 'linux';
  const watchOptions = isLinux ? {} : { recursive: true };
  fs.watch(rootPath, watchOptions, onFileChanged)
}

function activate(context) {
  loadJbeamFiles()
}

function deactivate() {
}

function findNodeByNameInAllParts(namespace, nodeName) {
  // TODO: find node in "vehicles/common" folder
  // but need the ability to select the part to get the node from if couldn't find node initially in "vehicles/namespace" folder
  let namespaces = [namespace] //[namespace, '/vehicles/common']
  for (let n of namespaces) {
    if (n in partData) {
      for(let partName in partData[n]) {
        let part = partData[n][partName].interpreted
        //console.log(`${n} : ${partName}`)
        if(part.nodes && part.nodes[nodeName]) {
          let node = part.nodes[nodeName]
          node.__meta.partOrigin = partName
          node.__meta.partNamespace = n
          node.__meta.origin = part.__meta.origin
          return node
        }
      }
    }
  }
  return null
}

module.exports = {
  activate,
  deactivate,
  partData,
  findNodeByNameInAllParts,
}
