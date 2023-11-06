const vscode = require('vscode');
const threeDPreview = require('./threeDPreview');
const jbeamSyntaxChecker = require('./jbeamSyntaxChecker');
const jbeamSymbolProviderExt = require('./jbeamSymbolProviderExt');
const jbeamHoverProvider = require('./jbeamHoverProvider');


function activate(context) {
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
