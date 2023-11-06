const vscode = require('vscode');
const threeDPreview = require('./threeDPreview');

function activate(context) {
  threeDPreview.activate(context)
}


function deactivate() {
}

module.exports = {
  activate,
  deactivate
}
