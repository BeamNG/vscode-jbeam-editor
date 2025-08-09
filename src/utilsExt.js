const vscode = require('vscode');
const path = require('path')

function convertUri(vscode, webPanel, filePath) {
  const uri = vscode.Uri.file(filePath);
  const webviewUri = webPanel.webview.asWebviewUri(uri);
  return webviewUri.toString()
}

function getNamespaceFromVirtualFilename(filename) {
  return '/' + filename.split(path.sep, 2).join(path.sep).replace(/\\/g, '/')
}

function getRootpath() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    console.error("not in workspace")
    return null
  }
  return workspaceFolders[0].uri.fsPath
}

function getNamespaceFromFilename(rootpath, filename) {
  return getNamespaceFromVirtualFilename(path.relative(rootpath, filename))
}

function deepCloneAndRemoveKeys(obj, keysToRemove) {
  if (typeof obj !== 'object' || obj === null) return obj; // Primitives or null

  let clone = Array.isArray(obj) ? [] : {};

  Object.keys(obj).forEach(key => {
    if (keysToRemove.includes(key)) return; // Skip specified keys
    clone[key] = deepCloneAndRemoveKeys(obj[key], keysToRemove); // Recurse for nested objects/arrays
  });

  return clone;
}

// checks if the position is in qotes or not
function checkQuotesWithoutNewlineInLine(text, position) {
  const lines = text.split('\n');
  if (position.line >= lines.length) return false;

  const line = lines[position.line];
  const noNewLineBeforeQuote = (str) => /[^\n]*"/.test(str)

  const firstHalfReversed = line.substring(0, position.character).split('').reverse().join('');
  const secondHalf = line.substring(position.character);

  return noNewLineBeforeQuote(firstHalfReversed) && noNewLineBeforeQuote(secondHalf);
}

function openFileInWorkspace(filePath, gotoRange = null) {
  let rootPath = getRootpath()
  if (rootPath) {
    if(gotoRange) {
      const start = new vscode.Position(gotoRange[0], gotoRange[1]);
      //const end = new vscode.Position(gotoRange[2], gotoRange[3]);
      gotoRange = new vscode.Range(start, start) // end);
    }
    const rel = path.relative(rootPath, filePath)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      console.error(`unable to open file ${filePath} - not part of the workspace!`)
      return
    }

    const fileUri = vscode.Uri.file(filePath)
    vscode.window.showTextDocument(fileUri, {selection: gotoRange});
  }
}


module.exports = {
  convertUri,
  getNamespaceFromFilename,
  getNamespaceFromVirtualFilename,
  getRootpath,
  deepCloneAndRemoveKeys,
  checkQuotesWithoutNewlineInLine,
  openFileInWorkspace,
}
