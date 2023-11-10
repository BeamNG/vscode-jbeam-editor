const vscode = require('vscode');

const sjsonParser = require('./sjsonParser');
const tableSchema = require('./tableSchema');

const jbeamDiagnostics = vscode.languages.createDiagnosticCollection('jbeam');

function validateTextDocument(textDocument) {
  if (textDocument.languageId !== 'jbeam') {
    return;
  }

  const diagnosticsList = [];
  const text = textDocument.getText();
  
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
  if(!parsedData) return

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

function activate(context) {
  // Register our linter to get called for our language 'jbeam'
  subscribeToDocumentChanges(context, jbeamDiagnostics);
}

function deactivate() {
  jbeamDiagnostics.clear();
}

module.exports = {
  activate,
  deactivate
}
