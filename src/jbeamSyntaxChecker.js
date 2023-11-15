const vscode = require('vscode');
const path = require('path')

const sjsonParser = require('./sjsonParser');
const tableSchema = require('./tableSchema');
const archivar = require('./archivar');
const utilsExt = require('./utilsExt');

const jbeamDiagnostics = vscode.languages.createDiagnosticCollection('jbeam');

function getPartnamesForNamespaces(namespaces, slotName, callback) {
  let partNameUnique = {}
  let list = []
  for(let namespace of namespaces) {
    if(!archivar.partData[namespace]) continue

    for(let partName in archivar.partData[namespace]) {
      const part = archivar.partData[namespace][partName]
      if(part.slotType !== slotName) continue
      let relPath
      if(rootpath) {
        relPath = path.relative(rootpath, part.__source)
      } else {
        relPath = part.__source
      }
      if(!partNameUnique[partName]) {
        list.push(callback(part, relPath))
        partNameUnique[partName] = true
      }
    }
  }
  return list
}

function getPartnamesForDocument(document, slotName, callback) {
  let rootpath = utilsExt.getRootpath()
  let namespaces = ['/vehicles/common']
  if(rootpath) {
    namespaces.push(utilsExt.getNamespaceFromFilename(rootpath, document.uri.fsPath))
  }
  return getPartnamesForNamespaces(namespaces, slotName, callback)
}

class PartConfigCompletionProvider {
  // see https://code.visualstudio.com/api/references/vscode-api#CompletionItemProvider.provideCompletionItems
  provideCompletionItems(document, position, token, context) {

    const text = document.getText()
    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);

    let dataBundle = sjsonParser.decodeWithMeta(text)
    if(!dataBundle) {
      return
    }
    let meta = sjsonParser.getMetaForCur(dataBundle, position.line, position.character)
    if(!meta || meta.lenght == 0) {
      return
    }

    let completionPartFoundFct = function(part, relPath) {
      return {
        label: partName,
        detail: `${relPath}`,
        kind: vscode.CompletionItemKind.Variable
      }
    }


    // we are above a value
    const firstMeta = meta[0]
    if((firstMeta.type == 'value' || firstMeta.type == 'objSeparator') && firstMeta.depth == 3) {
      let partSlotname = firstMeta.key.value
      let res = getPartnamesForDocument(document, partSlotname, completionPartFoundFct)
      console.log(`Completion items for ${position.line}:${position.character} ('${word}') - part: '${partSlotname}': ${res}`)
      return res
    } else {
      console.log(`unable to provide completion for this meta: ${position.line}:${position.character}: `, meta)
    }
  }
}


function validateTextDocument(textDocument) {
  if (textDocument.languageId !== 'jbeam' && textDocument.languageId !== 'partconfig') {
    return;
  }

  const diagnosticsList = []
  const text = textDocument.getText();
  
  // generic json things
  let parsedData
  try {
    parsedData = sjsonParser.decodeSJSON(text);
  } catch (e) {
    const pos = new vscode.Position(
      e.range ? e.range[0] : e.line ? e.line : 0,
      e.range ? e.range[1] : e.column ? e.column : 0
    )
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(pos, pos),
      `Exception while parsing SJSON: ${e.message}`,
      vscode.DiagnosticSeverity.Error
    );
    diagnosticsList.push(diagnostic);
    //throw e
  }

  // jbeam specific things
  if(textDocument.languageId === 'jbeam' && parsedData) {
    try {
      let [tableInterpretedData, diagnosticsTable] = tableSchema.processAllParts(parsedData)
      for (const w of diagnosticsTable) {
        // w[0] = type: error/warning
        // w[1] = message
        // w[2] = range = [linefrom, positionfrom, lineto, positionto]
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(new vscode.Position(w[2][0]-1, w[2][1]-1), new vscode.Position(w[2][2]-1, w[2][3])),
          w[1],
          w[0] == 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error
        );
        diagnosticsList.push(diagnostic);      
      }
    } catch (e) {
      const pos = new vscode.Position(
        e.range ? e.range[0] : e.line ? e.line : 0,
        e.range ? e.range[1] : e.column ? e.column : 0
      )
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(pos, pos),
        `Exception while parsing tables: ${e.message}`,
        vscode.DiagnosticSeverity.Error
      );
      diagnosticsList.push(diagnostic);
      throw e
    }
  }

  // Update the diagnostics collection for the file
  jbeamDiagnostics.set(textDocument.uri, diagnosticsList);
}

function subscribeToDocumentChanges(context, diagnostics) {
  // Check the document when it's first opened
  if (vscode.window.activeTextEditor) {
    validateTextDocument(vscode.window.activeTextEditor.document);
  }
  
  // Check the document when it's saved
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(validateTextDocument)
  );

  // Check the document when it's changed
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      validateTextDocument(event.document);
    })
  );

  // Clear diagnostics for closed documents
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(doc => jbeamDiagnostics.delete(doc.uri))
  );
}

let completionDisposable
function activate(context) {
  // Register our linter to get called for our language 'jbeam'
  subscribeToDocumentChanges(context, jbeamDiagnostics);

  completionDisposable = vscode.languages.registerCompletionItemProvider(
    { language: 'partconfig' },
    new PartConfigCompletionProvider()
  )
  context.subscriptions.push(completionDisposable)
}

function deactivate() {
  jbeamDiagnostics.clear();
  if(completionDisposable) completionDisposable.dispose()
}

module.exports = {
  activate,
  deactivate
}
