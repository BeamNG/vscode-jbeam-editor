/*
  Module: `extension.js`

  Description:
  This module serves as the main entry point for the BeamNG.jbeam Editor extension in Visual Studio Code. It initializes and manages various components of the extension.

  Exports:
  - `activate(context)`: Activates the extension and registers commands and event handlers.
  - `deactivate()`: Deactivates the extension and cleans up resources when it's deactivated.

  Usage Example:
  ```javascript
  const extension = require('./extension');

  // Activate the extension when Visual Studio Code starts
  extension.activate(context);

  // Deactivate the extension when it's no longer needed
  extension.deactivate();
  ```

  Notes: This module is the entry point for the BeamNG.jbeam Editor extension and manages its activation and deactivation, as well as registration of commands and event handlers.
*/
const vscode = require('vscode');
const threeDPreview = require('./threeDPreview');
const jbeamSyntaxChecker = require('./jbeam/syntaxChecker');
const jbeamSymbolProviderExt = require('./jbeam/symbolProvider');
const jbeamHoverProvider = require('./jbeam/hoverProvider');
const logProcessor = require('./logparser/logProcessor');
const simConnection = require('./simConnection');
const archivar = require('./archivar');
const partconfigValidationCompletion = require('./partconfig/validationCompletion');

// so apparently, on changing the workspace kills the extension

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('jbeam-editor.toggleConnectionWithSim', function () {
    simConnection.toggleConnection();
  }))

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

    if (event.affectsConfiguration('partconfig')) {
      partconfigValidationCompletion.deactivate()
      partconfigValidationCompletion.activate(context)
    }

  }))

  archivar.activate(context)
  simConnection.activate(context)
  threeDPreview.activate(context)
  jbeamSyntaxChecker.activate(context)
  jbeamSymbolProviderExt.activate(context)
  jbeamHoverProvider.activate(context)
  logProcessor.activate(context)
  partconfigValidationCompletion.activate(context)
}

function deactivate() {
  partconfigValidationCompletion.deactivate()
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
