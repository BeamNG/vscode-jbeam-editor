/**
 * VSCode extension module for updating Jbeam node data in the text editor.
 * This module processes node data in a Jbeam file, modifies the position values,
 * and replaces the old values in the document with the updated ones while preserving
 * the original text formatting.
 *
 * The flow consists of:
 * 1. Parsing the text into an AST (Abstract Syntax Tree) that captures every character exactly.
 * 2. Modifying the AST by changing the position values (X, Y, Z) of the nodes.
 * 3. Replacing the old values in the document with the updated ones based on metadata.
 */

const vscode = require('vscode');
const sjsonParser = require('./json/sjsonParser');

/**
 * Main function to update Jbeam node data in the active text editor.
 *
 * @param {Object} message - The message containing nodes and metadata.
 *        message.nodes - The array of nodes with updated position values.
 *        message.uri - The URI of the document being edited.
 */
async function updateJbeamNodeData(message, updateDataCallback) {
  //console.log("updateNode from 3d", message.nodes);

  // Sort nodes to ensure replacements are done from bottom to top and right to left
  const sortedNodes = message.nodes.sort((a, b) => {
    const endRowA = a.__meta.range[2]; // End line of the node
    const endRowB = b.__meta.range[2];
    if (endRowA !== endRowB) {
      return endRowB - endRowA; // Sort by line descending
    }
    const endColA = a.__meta.range[3]; // End column of the node
    const endColB = b.__meta.range[3];
    return endColB - endColA; // Sort by column descending
  });

  // Find the target editor based on the URI
  let targetEditor = vscode.window.visibleTextEditors.find(editor => {
    return editor.document.uri.toString() === message.uri;
  });

  if (!targetEditor) {
    console.error('Editor for uri not found: ', message.uri);
    return;
  }
  const documentText = targetEditor.document.getText();
  const dataBundle = sjsonParser.decodeWithMeta(documentText, message.uri, true)
  await targetEditor.edit(editBuilder => {
    for (let node of sortedNodes) {

      let metaDataStack = sjsonParser.getMetaForCurBundle(dataBundle, node.__meta.range[0], node.__meta.range[1])
      if(!metaDataStack || metaDataStack.length < 1) {
        continue
      }
      let nodeMetaData = metaDataStack[0]
      if(nodeMetaData.obj[0] != node.id) {
        console.error("id mismatch on replace?")
        continue
      }
      let startIdx = nodeMetaData.id
      // TODO: verify the validity of the array and all!
      // startIdx + 1 = id

      // Helper function to replace value in the document
      function replaceValue(meta, newValue) {
        const [startLine, startCol, endLine, endCol] = meta.range
        const startPos = new vscode.Position(startLine, startCol);
        const endPos = new vscode.Position(endLine, endCol);
        const vscodeRange = new vscode.Range(startPos, endPos);
        editBuilder.replace(vscodeRange, newValue.toString());
      }

      replaceValue(dataBundle.metaData[startIdx + 2], node.pos[0])
      replaceValue(dataBundle.metaData[startIdx + 3], -node.pos[2])
      replaceValue(dataBundle.metaData[startIdx + 4], node.pos[1])
    }
  });

  // Optionally, reveal the last edited node in the editor
  if (sortedNodes.length > 0) {
    const lastNode = sortedNodes[0]; // The first node in sorted order (bottom-most)
    if (lastNode.__meta && lastNode.__meta.range) {
      const [startLine, startCol] = lastNode.__meta.range;
      const lastNodeStart = new vscode.Position(startLine, startCol);
      targetEditor.selection = new vscode.Selection(lastNodeStart, lastNodeStart);
      targetEditor.revealRange(
        new vscode.Range(lastNodeStart, lastNodeStart),
        vscode.TextEditorRevealType.InCenter
      );
    }
  }
  updateDataCallback(targetEditor)
  return true
}

module.exports = {
  updateJbeamNodeData
};