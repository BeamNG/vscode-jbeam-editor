const vscode = require('vscode');
const sjsonParser = require('./sjsonParser');
const tableSchema = require('./tableSchema');

function goToLineForHover(args) {
  let decodedArgsUri = decodeURIComponent(args.uri);
  let targetEditor = vscode.window.visibleTextEditors.find(editor => {
    let decodedEditorUri = decodeURIComponent(editor.document.uri.toString());
    return decodedEditorUri === decodedArgsUri;
  });

  if (targetEditor) {
    const start = new vscode.Position(args.range[0] - 1, args.range[1] - 1);
    const end = new vscode.Position(args.range[2] - 1, args.range[3]);
    const highlightRange = new vscode.Range(start, end);

    // Go to the line and reveal it in the center of the viewport
    targetEditor.selection = new vscode.Selection(start, start);
    targetEditor.revealRange(highlightRange, vscode.TextEditorRevealType.InCenter);
  } else {
    console.error('Editor for uri not found: ', args.uri);
  }
}

function findObjectsWithRange(obj, line, position, uri) {
  let matches = [];
  let breadcrumbTrail = []; // Array to keep track of the breadcrumb trail

  // Helper function to recursively search the object
  function search(obj, currentDepth) {
    if (obj.__range &&
        line >= obj.__range[0] && line <= obj.__range[2] &&
        (line !== obj.__range[0] || position >= obj.__range[1]) &&
        (line !== obj.__range[2] || position <= obj.__range[3])) {
      matches.push({
        obj: obj,
        depth: currentDepth,
        breadcrumb: breadcrumbTrail.map(b => ({ name: b.name, __range: b.__range }))
      });
    }

    // Iterate over the properties of the object to go deeper into the tree
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === 'object' && value !== null && value.__range) {
          // Add the current object to the breadcrumb trail before going deeper
          breadcrumbTrail.push({ name: key, __range: value.__range });
          search(value, currentDepth + 1);
          // Pop the current object from the breadcrumb trail as we backtrack
          breadcrumbTrail.pop();
        }
      }
    }
  }

  search(obj, 0);

  // Sort matches by depth descending (deepest first)
  matches.sort((a, b) => b.depth - a.depth);

  // Map the results to include a clickable breadcrumb trail
  return matches.map(match => {
    let breadcrumbMarkdown = match.breadcrumb.map(breadcrumbPart => {
      let commandId = 'jbeam-editor.gotoLine';
      // Adjust the range for zero-based indexing in the editor
      let zeroBasedRange = [
        breadcrumbPart.__range[0] - 1,
        breadcrumbPart.__range[1] - 1,
        breadcrumbPart.__range[2] - 1,
        breadcrumbPart.__range[3] - 1,
      ];
      let args = {
        range: zeroBasedRange,
        uri: uri
      };
      let encodedArgs = encodeURIComponent(JSON.stringify(args));
      return `[${breadcrumbPart.name}](command:${commandId}?${encodedArgs})`;
    }).join(' > ');
  
    return {
      obj: match.obj,
      breadcrumb: breadcrumbMarkdown // Markdown links for each breadcrumb part
    };
  });
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

const keysToRemove = []

class JBeamHoverProvider {
  provideHover(document, position, token) {
    const text = document.getText();
    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);

    const contents = new vscode.MarkdownString();
    contents.isTrusted = true; // Allows for command links and other Markdown features
    //contents.appendMarkdown(`**You are hovering over:** ${word}\n\n`);

    let parsedData = sjsonParser.decodeSJSON(text);
    let [tableInterpretedData, disagnostics] = tableSchema.processAllParts(parsedData)
    if(tableInterpretedData) {
      const results = findObjectsWithRange(tableInterpretedData, position.line + 1, position.character + 1, document.uri.toString());
      if(results && results.length > 0) {
        let foundObjClean = deepCloneAndRemoveKeys(results[0].obj, keysToRemove)
        contents.appendMarkdown(`#### ${results[0].breadcrumb}\n`);
        contents.appendCodeblock(JSON.stringify(foundObjClean, null, 2), 'json');
      }
    }


    return new vscode.Hover(contents, range);
  }
}

function activate(context) {
  context.subscriptions.push(vscode.languages.registerHoverProvider(
    { language: 'jbeam' },
    new JBeamHoverProvider()
  ))

  context.subscriptions.push(vscode.commands.registerCommand('jbeam-editor.gotoLine', goToLineForHover));
}

function deactivate() {
}

module.exports = {
  activate,
  deactivate
}
