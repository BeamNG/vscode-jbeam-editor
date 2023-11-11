const vscode = require('vscode');

function processLogFile(document, diagnosticCollection) {
  const diagnostics = []

  const text = document.getText()
  const uri = document.uri.toString()
  const lines = text.split(/\r?\n/)

  for(let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo]
    const args = line.split('|', 4)
    if(args.length != 4) continue

    let severity
    if(args[1] == 'D') continue // shortcut, most common case
    else if(args[1] == 'E') severity = vscode.DiagnosticSeverity.Error
    else if(args[1] == 'W') severity = vscode.DiagnosticSeverity.Warning
    else if(args[1] == 'I') severity = vscode.DiagnosticSeverity.Information

    // ignore debug things
    if(!severity) continue

    const range = new vscode.Range(new vscode.Position(lineNo + 1, 0), new vscode.Position(lineNo + 1, line.length))
    const diagnostic = new vscode.Diagnostic(range, args[3].substring(1), severity)
    diagnostics.push(diagnostic);
  }

  diagnosticCollection.set(uri, diagnostics)
}

function activate(context) {
  let diagnosticCollection = vscode.languages.createDiagnosticCollection('BeamNGLog');
  context.subscriptions.push(diagnosticCollection);

  // Process all currently open text documents
  vscode.workspace.textDocuments.forEach(document => {
    if (document.languageId === 'beamng-log') {
      processLogFile(document, diagnosticCollection)
    }
  })

  // Process documents that are opened after the extension is activated
  vscode.workspace.onDidOpenTextDocument((document) => {
    if (document.languageId === 'beamng-log') {
      processLogFile(document, diagnosticCollection)
    }
  })

  // Listen for changes in the document of the active editor
  vscode.workspace.onDidChangeTextDocument(event => {
    if (event.document.languageId === 'beamng-log') {
      processLogFile(event.document, diagnosticCollection)
    }
  })
  
}

function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
}

module.exports = {
  activate,
  deactivate
}