const vscode = require('vscode');
const path = require('path')

const sjsonParser = require('../json/sjsonParser');
const tableSchema = require('../json/tableSchema');
const archivar = require('../archivar');
const utilsExt = require('../utilsExt');

const partconfigDiagnostics = vscode.languages.createDiagnosticCollection('partconfig');

// a slot is defined in its parent part, so all known parts need to be searched to find out which
// part types fit into a slot name. With legacy slots the slot name is the slot type itself
function getSlotTypesForName(namespaces, slotName) {
  let allowTypes = new Set()
  let denyTypes = new Set()
  let slotFound = false
  for(let namespace of namespaces) {
    const parts = archivar.partData[namespace]
    if(!parts) continue
    for(let partName in parts) {
      const slots = parts[partName].interpreted?.slots2
      if(!slots) continue
      for(let rowKey in slots) {
        if(rowKey === '__meta') continue
        const slot = slots[rowKey]
        if(!slot || slot.name !== slotName) continue
        slotFound = true
        for(let slotType of utilsExt.getStringList(slot.allowTypes)) allowTypes.add(slotType)
        for(let slotType of utilsExt.getStringList(slot.denyTypes)) denyTypes.add(slotType)
      }
    }
  }
  if(!slotFound) allowTypes.add(slotName)
  return [allowTypes, denyTypes]
}

function getPartnamesForNamespaces(namespaces, slotName, callback) {
  let partNameUnique = {}
  let list = []
  const rootpath = utilsExt.getRootpath()
  const [allowTypes, denyTypes] = getSlotTypesForName(namespaces, slotName)
  for(let namespace of namespaces) {
    if(!archivar.partData[namespace]) {
      console.error(`Namepspace not found: ${namespace}`)
      continue
    }

    for(let partName in archivar.partData[namespace]) {
      const part = archivar.partData[namespace][partName].raw
      // a single slotType ends up in the part options while the tables are processed, a list of them stays in place
      const partSlotTypes = utilsExt.getStringList(part.slotType ?? part.options?.slotType)
      if(!partSlotTypes.some(slotType => allowTypes.has(slotType))) continue
      if(partSlotTypes.some(slotType => denyTypes.has(slotType))) continue
      let relPath
      if(rootpath) {
        relPath = path.relative(rootpath, part.__meta.origin)
      } else {
        relPath = part.__meta.origin
      }
      if(!partNameUnique[partName]) {
        list.push(callback(partName, part, relPath))
        partNameUnique[partName] = true
      }
    }
  }
  return list
}

function getPartnamesForDocument(document, slotName, callback) {
  const rootpath = utilsExt.getRootpath()
  let namespaces = ['/vehicles/common']
  if(rootpath) {
    namespaces.push(utilsExt.getNamespaceFromFilename(rootpath, document.uri.fsPath))
  }
  return getPartnamesForNamespaces(namespaces, slotName, callback)
}
const highlights = [
  vscode.window.createTextEditorDecorationType({backgroundColor: 'rgba(255, 0, 0, 0.3)'}),
  vscode.window.createTextEditorDecorationType({backgroundColor: 'rgba(0, 255, 0, 0.3)'}),
  vscode.window.createTextEditorDecorationType({backgroundColor: 'rgba(255, 0, 255, 0.3)'}),
]

function debugHighlight(document, range, type) {
  let editor = vscode.window.visibleTextEditors.find(editor => {
    return document.uri === editor.document.uri;
  })

  if(!range) {
    editor.setDecorations(highlights[type], []);
    return
  }

  const start = new vscode.Position(range[0], range[1]);
  const end = new vscode.Position(range[2], range[3]);
  const rangeToHighlight = new vscode.Range(start, end);

  editor.setDecorations(highlights[type], [rangeToHighlight]);
}


class PartConfigCompletionProvider {
  // see https://code.visualstudio.com/api/references/vscode-api#CompletionItemProvider.provideCompletionItems
  async provideCompletionItems(document, position, token, context) {
    if (!await archivar.ensureNamespacesForDocument(document)) return
    if (token.isCancellationRequested) return
    //console.log("provideCompletionItems", document, position, token, context)

    const text = document.getText()
    const range = document.getWordRangeAtPosition(position, /[^\"]+/)
    let word
    if(range) {
      word = document.getText(range)
    }

    let isInQuotes = utilsExt.checkQuotesWithoutNewlineInLine(text, position)

    let dataBundle = sjsonParser.decodeWithMeta(text)
    if(!dataBundle) {
      console.log('unable to get data from document: ', document.uri.fsPath, text)
      return
    }
    let meta = sjsonParser.getMetaForCurBundle(dataBundle, position.line, position.character)
    if(!meta || meta.length == 0) {
      console.log('unable to get data below cursor: ', document.uri.fsPath, text, position)
      return
    }
    const firstMeta = meta[0]

    if(meta.length > 0) debugHighlight(document, meta[0].range, 0)
    //if(meta.length > 1) debugHighlight(document, meta[1].range, 1)
    //if(meta.length > 2) debugHighlight(document, meta[2].range, 2)

    let completionPartFoundFct = function(partName, part, relPath) {
      let res = {
        label: partName,
        //detail: `${relPath}`,
        kind: vscode.CompletionItemKind.Variable,
        range: range,
      }
      if(!isInQuotes) {
        res.insertText = `"${partName}"` // add quotes
      }
      return res
    }


    // we are above a value
    if((firstMeta.type == 'value' || firstMeta.type == 'objSeparator') && firstMeta.depth == 3) {
      let partSlotname = firstMeta.key.value
      debugHighlight(document, firstMeta.key.range, 1)
      let res = getPartnamesForDocument(document, partSlotname, completionPartFoundFct)
      // add empty
      res.unshift({
        label: "<empty>",
        kind: vscode.CompletionItemKind.Variable,
        range: range,
        insertText: "",
      })
      console.log(`Completion items for ${position.line}:${position.character} ('${word ? word : ''}') - part: '${partSlotname}': ${JSON.stringify(res, null, 2)}`)
      return res
    } else {
      console.log(`unable to provide completion for this meta: ${position.line}:${position.character}: ${JSON.stringify(meta, null, 2)}`)
    }
  }

  resolveCompletionItem(item, token) {
    //console.log('resolveCompletionItem', item, token)
  }
}


function validateTextDocument(textDocument) {
  if (textDocument.languageId !== 'partconfig') {
    return;
  }
  let dataBundle = sjsonParser.decodeWithMetaWithDiagnostics(textDocument.getText(), textDocument.uri.fsPath)
  partconfigDiagnostics.set(textDocument.uri, dataBundle.diagnosticsList);
}

function subscribeToDocumentChanges(context, diagnostics) {
  // Check the document when it's first opened
  if (vscode.window.activeTextEditor) {
    validateTextDocument(vscode.window.activeTextEditor.document);
  }

  // Check the document when it's changed
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      validateTextDocument(event.document);
    })
  );
}

let completionDisposable
function activate(context) {
  subscribeToDocumentChanges(context, partconfigDiagnostics);
  completionDisposable = vscode.languages.registerCompletionItemProvider(
    { language: 'partconfig' },
    new PartConfigCompletionProvider(),
    ":\"" // triggerCharacters
  )
  context.subscriptions.push(completionDisposable)
}

function deactivate() {
  partconfigDiagnostics.clear();
  if(completionDisposable) completionDisposable.dispose()
}

module.exports = {
  activate,
  deactivate
}
