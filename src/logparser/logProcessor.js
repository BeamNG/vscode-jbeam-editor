/**
 * Processes BeamNG log files for diagnostics.
 * 
 * Parses log lines for severity and message, creating diagnostics based on user settings.
 * Handles Error, Warning, and optionally Info levels. Ignores Debug messages.
 */
const vscode = require('vscode');

let diagnosticCollection

function processLogDocument(document) {
  if (document.languageId !== 'beamng-log') return

  try {
    const pareInfo = (vscode.workspace.getConfiguration('beamng-log').get('parseInfo', false))
    const diagnosticList = []
    const text = document.getText()
    const lines = text.split(/\r?\n/)

    for(let lineNo = 0; lineNo < lines.length; lineNo++) {
      const line = lines[lineNo]
      const args = line.split('|', 4)
      if(args.length != 4) continue

      let severity = vscode.DiagnosticSeverity.Hint
      if(args[1] === 'D') continue // shortcut, most common case
      else if(args[1] === 'E') severity = vscode.DiagnosticSeverity.Error
      else if(args[1] === 'W') severity = vscode.DiagnosticSeverity.Warning
      else if(args[1] === 'I' && pareInfo) severity = vscode.DiagnosticSeverity.Information


      const message = (args[2] ? args[2] : "") + ": " + (args[3] && args[3].length > 1) ? args[3].substring(1) : 'No message provided';

      const range = new vscode.Range(new vscode.Position(lineNo, 0), new vscode.Position(lineNo, line.length))
      const diagnostic = new vscode.Diagnostic(range, message, severity)
      diagnosticList.push(diagnostic);
    }

    if(diagnosticCollection) {
      diagnosticCollection.set(document.uri, diagnosticList)
    }
  } catch(e) {
    console.error("error while parsing log: ", e)
  }
}

function activate(context) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('beamng-log');
  // Process all currently open text documents
  vscode.workspace.textDocuments.forEach(document => {
    processLogDocument(document)
  })

  // Process documents that are opened after the extension is activated
  vscode.workspace.onDidOpenTextDocument((document) => {
    processLogDocument(document)
  })

  // Listen for changes in the document of the active editor
  vscode.workspace.onDidChangeTextDocument(event => {
    processLogDocument(event.document)
  })
}

function deactivate() {
  diagnosticCollection.dispose()
  diagnosticCollection = null
}

module.exports = {
  activate,
  deactivate
}
