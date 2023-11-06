const vscode = require('vscode');

const sjsonParser = require('./sjsonParser');
const tableSchema = require('./tableSchema');

const jbeamDiagnostics = vscode.languages.createDiagnosticCollection('jbeam');

function validateTextDocument(textDocument) {
  if (textDocument.languageId !== 'jbeam') {
    return;
  }

  const diagnostics = [];
  const text = textDocument.getText();
  
  try {
    let parsedData = sjsonParser.decodeSJSON(text);
    let tableInterpretedData = tableSchema.processAllParts(parsedData)
  } catch (e) {
    const position = new vscode.Position(e.line, e.position);
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(position, position),
      `Error parsing SJSON: ${e.message}`,
      vscode.DiagnosticSeverity.Error
    );
    diagnostics.push(diagnostic);
  }

  // Update the diagnostics collection for the file
  jbeamDiagnostics.set(textDocument.uri, diagnostics);
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
