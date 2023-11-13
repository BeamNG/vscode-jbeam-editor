const vscode = require('vscode');
const threeDPreview = require('./threeDPreview');
const jbeamSyntaxChecker = require('./jbeamSyntaxChecker');
const jbeamSymbolProviderExt = require('./jbeamSymbolProviderExt');
const jbeamHoverProvider = require('./jbeamHoverProvider');
const logProcessor = require('./logProcessor');
const simConnection = require('./simConnection');
const archivar = require('./archivar');


// so apparently, on changing the workspace kills the extension

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('jbeam-editor.syncWithSim', function () {
    simConnection.sync()
  }))
  
  context.subscriptions.push(vscode.commands.registerCommand('jbeam-editor.openSettings', function () {
    vscode.commands.executeCommand('workbench.action.openSettings', '@ext:beamng.jbeam-editor');
  }))

  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    // Check if the change affects your extension's configuration: reload everything affected
    
    if (event.affectsConfiguration('jbeam-editor')) {
      threeDPreview.deactivate()
      jbeamSyntaxChecker.deactivate()
      jbeamSymbolProviderExt.deactivate()
      jbeamHoverProvider.deactivate()
      archivar.deactivate()

      // be careful about the order

      archivar.activate(context)
      threeDPreview.activate(context)
      jbeamSyntaxChecker.activate(context)
      jbeamSymbolProviderExt.activate(context)
      jbeamHoverProvider.activate(context)
    }

    if (event.affectsConfiguration('beamng-log')) {
      logProcessor.deactivate()
      logProcessor.activate(context)
    }
  }))

  archivar.activate(context)
  simConnection.activate(context)
  threeDPreview.activate(context)
  jbeamSyntaxChecker.activate(context)
  jbeamSymbolProviderExt.activate(context)
  jbeamHoverProvider.activate(context)
  logProcessor.activate(context)
}

function deactivate() {
  archivar.deactivate()
  simConnection.deactivate()
  threeDPreview.deactivate()
  jbeamSyntaxChecker.deactivate()
  jbeamSymbolProviderExt.deactivate()
  jbeamHoverProvider.deactivate()
  dataView.deactivate()
  logProcessor.deactivate()
}

module.exports = {
  activate,
  deactivate
}
