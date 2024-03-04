// this file parses the json and table schema and injects warnings and errors into the problem list in vscode
// it does not do any processing of the parsed data

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
    dataBundle = sjsonParser.decodeWithMetaWithDiagnostics(contentTextUtf8, document.uri.fsPath, false)
    if(dataBundle) {
        diagnosticsList.push(...dataBundle.diagnosticsList)
    }
  } catch (e) {
    const pos = new vscode.Position(0, 0)
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
    } catch (e) {
      const pos = new vscode.Position(0, 0)
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
