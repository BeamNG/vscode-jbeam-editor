const vscode = require('vscode');
const threeDPreview = require('./threeDPreview');
const jbeamSyntaxChecker = require('./jbeamSyntaxChecker');
const jbeamSymbolProviderExt = require('./jbeamSymbolProviderExt');
const jbeamHoverProvider = require('./jbeamHoverProvider');

function activate(context) {

  context.subscriptions.push(vscode.commands.registerCommand('jbeam-editor.openSettings', function () {
    vscode.commands.executeCommand('workbench.action.openSettings', '@ext:beamng.jbeam-editor');
  }))

  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    // Check if the change affects your extension's configuration
    if (event.affectsConfiguration('jbeam-editor')) {
      // reload everything...
      threeDPreview.deactivate()
      jbeamSyntaxChecker.deactivate()
      jbeamSymbolProviderExt.deactivate()
      jbeamHoverProvider.deactivate()

      threeDPreview.activate(context)
      jbeamSyntaxChecker.activate(context)
      jbeamSymbolProviderExt.activate(context)
      jbeamHoverProvider.activate(context)
    }
  }))

  threeDPreview.activate(context)
  jbeamSyntaxChecker.activate(context)
  jbeamSymbolProviderExt.activate(context)
  jbeamHoverProvider.activate(context)
}

function deactivate() {
  threeDPreview.deactivate()
  jbeamSyntaxChecker.deactivate()
  jbeamSymbolProviderExt.deactivate()
  jbeamHoverProvider.deactivate()
}

module.exports = {
  activate,
  deactivate
}
