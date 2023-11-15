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
  const rootpath = utilsExt.getRootpath()
  for(let namespace of namespaces) {
    if(!archivar.partData[namespace]) {
      console.error(`Namepspace not found: ${namespace}`)
      continue
    }

    for(let partName in archivar.partData[namespace]) {
      const part = archivar.partData[namespace][partName]
      if(part.slotType !== slotName) continue
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

// checks if the position is in qotes or not
function checkQuotesWithoutNewlineInLine(text, position) {
  const lines = text.split('\n');
  if (position.line >= lines.length) return false;

  const line = lines[position.line];
  const noNewLineBeforeQuote = (str) => /[^\n]*"/.test(str)

  const firstHalfReversed = line.substring(0, position.character).split('').reverse().join('');
  const secondHalf = line.substring(position.character);

  return noNewLineBeforeQuote(firstHalfReversed) && noNewLineBeforeQuote(secondHalf);
}


class PartConfigCompletionProvider {
  // see https://code.visualstudio.com/api/references/vscode-api#CompletionItemProvider.provideCompletionItems
  provideCompletionItems(document, position, token, context) {
    console.log("provideCompletionItems", document, position, token, context)

    const text = document.getText()
    const range = document.getWordRangeAtPosition(position)
    let word
    if(range) {
      word = document.getText(range)
    }
    
    let isInQuotes = checkQuotesWithoutNewlineInLine(text, position)

    let dataBundle = sjsonParser.decodeWithMeta(text)
    if(!dataBundle) {
      console.log('unable to get data from document: ', document.uri.fsPath, text)
      return
    }
    let meta = sjsonParser.getMetaForCur(dataBundle, position.line, position.character)
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
        label: "",
        kind: vscode.CompletionItemKind.Variable,
        range: range,
      })
      console.log(`Completion items for ${position.line}:${position.character} ('${word ? word : ''}') - part: '${partSlotname}': ${JSON.stringify(res, null, 2)}`)
      return res
    } else {
      console.log(`unable to provide completion for this meta: ${position.line}:${position.character}: ${JSON.stringify(meta, null, 2)}`)
    }
  }

  resolveCompletionItem(item, token) {
    console.log('resolveCompletionItem', item, token)

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
    new PartConfigCompletionProvider(),
    ":\"" // triggerCharacters
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
