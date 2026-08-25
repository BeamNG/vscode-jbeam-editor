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
const utilsExt = require('./utilsExt');
const jbeamVariables = require('./json/jbeamVariables');

let jbeamFileData = {} // the root that holds all data
let partData = {}
let rootPath
let jbeamFileCounter = 0
let partCounter = 0
const loadedNamespaces = new Set()
const loadingNamespaces = new Map()
const failedFilesByNamespace = new Map()
let watcher
let archiveGeneration = 0

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
  if (!rootPath || path.extname(filename) !== '.jbeam') return
  const namespace = utilsExt.getNamespaceFromFilename(rootPath, filename)
  if (!loadedNamespaces.has(namespace)) return

  removeJbeamFileData(filename)
  processOrRemember(namespace, filename)
  updateStatus()
}

function onFileChanged(filename) {
  if (!rootPath || !filename) return
  if (fileDebounceMap.has(filename)) {
    clearTimeout(fileDebounceMap.get(filename))
  }
  fileDebounceMap.set(filename, setTimeout(() => {
    onFileChangedDebounced(filename)
    fileDebounceMap.delete(filename)
  }, debounceTime));
}

function updateStatus(message) {
  statusBar.text = message || `$(project) ${jbeamFileCounter} loaded JBeam files $(repo) ${partCounter} parts`
}

function processOrRemember(namespace, filename) {
  try {
    processJbeamFile(filename)
    failedFilesByNamespace.get(namespace)?.delete(filename)
  } catch (error) {
    if (!failedFilesByNamespace.has(namespace)) failedFilesByNamespace.set(namespace, new Set())
    failedFilesByNamespace.get(namespace).add(filename)
    console.error(`Unable to parse ${filename}:`, error)
  }
}

async function ensureNamespace(namespace) {
  if (!rootPath || !namespace?.startsWith('/vehicles/')) return true
  if (loadedNamespaces.has(namespace)) {
    for (const filename of failedFilesByNamespace.get(namespace) || []) processOrRemember(namespace, filename)
    return true
  }
  if (loadingNamespaces.has(namespace)) return loadingNamespaces.get(namespace)

  const generation = archiveGeneration
  const started = Date.now()
  const pattern = new vscode.RelativePattern(rootPath, `${namespace.slice(1)}/**/*.jbeam`)
  updateStatus(`$(loading~spin) Loading ${namespace} JBeam files ...`)

  const loading = vscode.workspace.findFiles(pattern, null).then(files => {
    if (generation !== archiveGeneration) return false
    for (const file of files) processOrRemember(namespace, file.fsPath)
    loadedNamespaces.add(namespace)
    const elapsed = Date.now() - started
    const failedCount = failedFilesByNamespace.get(namespace)?.size || 0
    updateStatus()
    statusBar.tooltip = `${namespace}: ${files.length} files parsed in ${elapsed} ms, ${failedCount} failed`
    return true
  }).finally(() => {
    if (loadingNamespaces.get(namespace) === loading) loadingNamespaces.delete(namespace)
  })
  loadingNamespaces.set(namespace, loading)
  return loading
}

async function ensureNamespacesForDocument(document) {
  if (!rootPath || !document) return true
  const generation = archiveGeneration
  const namespaces = new Set()
  const addDocumentNamespace = doc => {
    const namespace = utilsExt.getNamespaceFromFilename(rootPath, doc.uri.fsPath)
    if (namespace.startsWith('/vehicles/')) namespaces.add(namespace)
  }

  addDocumentNamespace(document)
  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.languageId === 'jbeam') addDocumentNamespace(editor.document)
  }
  namespaces.add('/vehicles/common')
  for (const namespace of namespaces) {
    if (!await ensureNamespace(namespace) || generation !== archiveGeneration) return false
  }
  return true
}

function activate(context) {
  archiveGeneration++
  rootPath = utilsExt.getRootpath()
  jbeamFileCounter = 0
  partCounter = 0
  updateStatus('$(project) JBeam archive loads on demand')
  statusBar.show()

  if (!rootPath) {
    console.error('unable to load jbeam: not in a workspace')
    statusBar.hide()
    return
  }

  watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(rootPath, '**/*.jbeam'))
  watcher.onDidCreate(uri => onFileChanged(uri.fsPath))
  watcher.onDidChange(uri => onFileChanged(uri.fsPath))
  watcher.onDidDelete(uri => onFileChanged(uri.fsPath))
  if (context?.subscriptions) context.subscriptions.push(watcher)
}

function deactivate() {
  archiveGeneration++
  if (watcher) watcher.dispose()
  watcher = null
  for (const timer of fileDebounceMap.values()) clearTimeout(timer)
  fileDebounceMap.clear()
  loadedNamespaces.clear()
  loadingNamespaces.clear()
  failedFilesByNamespace.clear()
  for (const key of Object.keys(jbeamFileData)) delete jbeamFileData[key]
  for (const key of Object.keys(partData)) delete partData[key]
  jbeamFileCounter = 0
  partCounter = 0
  rootPath = null
  statusBar.hide()
}

/*
  Slot variables are defined by the part that owns the slot, so a part that is opened on its own
  can only get them by looking at all known parts. There can be more than one parent, a seat
  occupant fits into every seat for example, so the parts are walked in a stable order and the
  first slot that accepts one of the slot types wins.
*/
function findSlotContext(preferredNamespace, slotTypes, childPartName, visited) {
  if (!slotTypes || slotTypes.length === 0) return null
  const wantedTypes = new Set(slotTypes)
  const namespaces = Object.keys(partData).sort((a, b) => {
    if (a === preferredNamespace) return -1
    if (b === preferredNamespace) return 1
    if (a === '/vehicles/common') return -1
    if (b === '/vehicles/common') return 1
    return a.localeCompare(b)
  })
  let fallback = null

  for (const namespace of namespaces) {
    for (const partName of Object.keys(partData[namespace]).sort()) {
      if (visited.has(namespace + '\0' + partName)) continue
      const parentPart = partData[namespace][partName].interpreted
      const slots = parentPart?.slots2 || parentPart?.slots
      if (!slots) continue
      for (const rowKey in slots) {
        if (rowKey === '__meta') continue
        const slot = slots[rowKey]
        if (!slot) continue
        const allowTypes = slot.allowTypes || slot.type
        if (!utilsExt.getStringList(allowTypes).some(slotType => wantedTypes.has(slotType))) continue
        if (utilsExt.getStringList(slot.denyTypes).some(slotType => wantedTypes.has(slotType))) continue
        const context = {
          namespace,
          parentPartName: partName,
          slotVariables: typeof slot.variables === 'object' ? slot.variables : {},
        }
        if (slot.default === childPartName) return context
        if (!fallback) fallback = context
      }
    }
  }
  return fallback
}

function resolveArchivedScope(namespace, partName, visited) {
  const key = namespace + '\0' + partName
  if (visited.has(key)) return {}
  visited.add(key)

  const part = partData[namespace]?.[partName]?.interpreted
  if (!part) return {}
  const localVariables = part.__meta?.variableScope || {}
  const slotTypes = utilsExt.getStringList(part.slotType ?? part.options?.slotType)
  const context = findSlotContext(namespace, slotTypes, partName, visited)
  if (!context) return localVariables

  const parentVariables = resolveArchivedScope(context.namespace, context.parentPartName, visited)
  return jbeamVariables.mergeVariableScopes(parentVariables, localVariables, context.slotVariables)
}

function getSlotVariables(preferredNamespace, slotTypes, childPartName) {
  const visited = new Set([preferredNamespace + '\0' + childPartName])
  const context = findSlotContext(preferredNamespace, slotTypes, childPartName, visited)
  if (!context) return null
  return {
    parentVariables: resolveArchivedScope(context.namespace, context.parentPartName, visited),
    slotVariables: context.slotVariables,
  }
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
  ensureNamespace,
  ensureNamespacesForDocument,
  getSlotVariables,
  findNodeByNameInAllParts,
}
