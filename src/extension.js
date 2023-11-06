const vscode = require('vscode');
const threeDPreview = require('./threeDPreview');
const jbeamSyntaxChecker = require('./jbeamSyntaxChecker');
const jbeamSymbolProviderExt = require('./jbeamSymbolProviderExt');


function activate(context) {
  threeDPreview.activate(context)
  jbeamSyntaxChecker.activate(context)
  jbeamSymbolProviderExt.activate(context)
}

function deactivate() {
  threeDPreview.deactivate()
  jbeamSyntaxChecker.deactivate()
  jbeamSymbolProviderExt.deactivate()
}

module.exports = {
  activate,
  deactivate
}
