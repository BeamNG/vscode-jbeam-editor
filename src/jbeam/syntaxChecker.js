const vscode = require('vscode');
const path = require('path')

const sjsonParser = require('../json/sjsonParser');
const tableSchema = require('../json/tableSchema');
const archivar = require('../archivar');
const utilsExt = require('../utilsExt');

const jbeamDiagnostics = vscode.languages.createDiagnosticCollection('jbeam');

function validateTextDocument(document) {
  if (document.languageId !== 'jbeam') {
    return;
  }

  const diagnosticsList = []
  const contentTextUtf8 = document.getText()

  // generic json things
  let dataBundle
  try {
    dataBundle = sjsonParser.decodeWithMeta(contentTextUtf8, document.uri.fsPath)
    if(dataBundle) {
      for (const e of dataBundle.errors) {
        // e.message, e.range
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(new vscode.Position(e.range[0], e.range[1]), new vscode.Position(e.range[2], e.range[3])),
          e.message,
          vscode.DiagnosticSeverity.Error
        );
        diagnosticsList.push(diagnostic);
      }
    }
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
  if(dataBundle && diagnosticsList.length === 0) {
    try {
      let [tableInterpretedData, diagnostics] = tableSchema.processAllParts(dataBundle.data)
      for (const w of diagnostics) {
        // w[0] = type: error/warning
        // w[1] = message
        // w[2] = range = [linefrom, positionfrom, lineto, positionto]
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(new vscode.Position(w[2][0], w[2][1]), new vscode.Position(w[2][2], w[2][3])),
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
      //throw e
    }
  }

  // Update the diagnostics collection for the file
  jbeamDiagnostics.set(document.uri, diagnosticsList);
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
  subscribeToDocumentChanges(context, jbeamDiagnostics);
}

function deactivate() {
  jbeamDiagnostics.clear();
  if(completionDisposable) completionDisposable.dispose()
}

module.exports = {
  activate,
  deactivate
}
