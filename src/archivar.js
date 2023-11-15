const vscode = require('vscode');

const sjsonParser = require('./sjsonParser');
const tableSchema = require('./tableSchema');
const path = require('path')
const fs = require('fs');
const utilsExt = require('./utilsExt');

let jbeamFileData = {} // the root that holds all data
let partData = {}
let rootPath
let jbeamFileCounter = 0
let partCounter = 0

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

  console.log(">>> ", filename)
  const namespace = utilsExt.getNamespaceFromFilename(rootPath, filename)
      
  jbeamFileCounter++
  const contentTextUtf8 = fs.readFileSync(filename, 'utf8');
  if(contentTextUtf8) {
    let dataBundle
    try {
      dataBundle = sjsonParser.decodeWithMeta(contentTextUtf8, filename)
      if(dataBundle.errors.length > 0) {
        console.error(`Error parsing json file ${filename} - ${dataBundle.errors}`)
        return false
      }
    } catch (e) {
      console.error(`Error parsing json file ${filename} - ${e.message}`)
      throw e
      return false
    }
    if(dataBundle) {
      if(!jbeamFileData[namespace]) {
        jbeamFileData[namespace] = {}
      }
      jbeamFileData[namespace][filename] = dataBundle
      //console.log(`${filename} [${namespace}] contains ${Object.keys(dataBundle.data).length} parts ...`);


      let partNames = Object.keys(dataBundle.data).filter(key => !utilsExt.excludedMagicKeys.includes(key))
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
  }
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
    partCounter = 0
    removeJbeamFileData(filename)
    processJbeamFile(filename)
    console.log(`Part count diff after updating file: ${partCounter}: ${filename}`)
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
  rootPath = utilsExt.getRootpath()
  if (!rootPath) {
    console.error('unable to load jbeam: not in a workspace')
    return
  }

  const vehiclesPath = vscode.Uri.file(path.join(rootPath, '/vehicles/')).fsPath
  jbeamFileCounter = 0
  partCounter = 0
  
  let findFilesPromises = []
  // Find .jbeam files
  findFilesPromises.push(vscode.workspace.findFiles(new vscode.RelativePattern(vehiclesPath, '**/*.jbeam'), null).then(files => {
    console.log(`Parsing ${files.length} jbeam files ...`)
    for(let file of files) {
      jbeamFileCounter++
      processJbeamFile(file.fsPath)
    }
  }));
  Promise.all(findFilesPromises).then(allFilesArrays => {
    console.log(`Parsed ${jbeamFileCounter} jbeam files containing ${partCounter} parts`)

    //for(let namespace in partData) {
    //  console.log(` * ${namespace} - ${Object.keys(partData[namespace]).length} parts`)
    //}
  })

  // now watch for changes
  fs.watch(rootPath, {recursive: true}, onFileChanged)
}

function activate(context) {
  //loadJbeamFiles()
}

function deactivate() {
}

module.exports = {
  activate,
  deactivate,
  partData,
}
