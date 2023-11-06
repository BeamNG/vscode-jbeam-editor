const vscode = require('vscode');
const sjsonParser = require('./sjsonParser');
const tableSchema = require('./tableSchema');

const highlightDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 255, 0, 0.1)', // yellow background for highlighting
});  
const fadeDecorationType = vscode.window.createTextEditorDecorationType({
  color: 'rgba(200, 200, 200, 0.9)',
});

function applyFadeEffectToDocument(editor, rangeToHighlight) {
  const fullRange = new vscode.Range(
    0,
    0,
    editor.document.lineCount - 1,
    editor.document.lineAt(editor.document.lineCount - 1).text.length
  );

  const rangesToFade = [
    new vscode.Range(fullRange.start, rangeToHighlight.start),
    new vscode.Range(rangeToHighlight.end, fullRange.end),
  ];

  // Set the fade decoration for all the document except the highlighted range

  // this is quite intrusive and meant for debugging only
  editor.setDecorations(fadeDecorationType, rangesToFade);

  // Set the highlight decoration for the range to be highlighted
  editor.setDecorations(highlightDecorationType, [rangeToHighlight]);
}

function goToLineForHover(args) {
  let decodedArgsUri = decodeURIComponent(args.uri);
  let targetEditor = vscode.window.visibleTextEditors.find(editor => {
    let decodedEditorUri = decodeURIComponent(editor.document.uri.toString());
    return decodedEditorUri === decodedArgsUri;
  });

  if (targetEditor) {
    const start = new vscode.Position(args.range[0], args.range[1]);
    const end = new vscode.Position(args.range[2], args.range[3]);
    const highlightRange = new vscode.Range(start, end);

    applyFadeEffectToDocument(targetEditor, highlightRange);

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
      let args = {
        range: breadcrumbPart.__range,
        uri: uri
      };
      let encodedArgs = encodeURIComponent(JSON.stringify(args));
      return `[${breadcrumbPart.name}](command:${commandId}?${encodedArgs})`;
    }).join(' > ');
  
    // Create a plain text breadcrumb trail, ignoring the first element and any array indices
    let breadcrumbPlainText = match.breadcrumb
      .slice(1) // This skips the first element
      .filter(breadcrumbPart => isNaN(breadcrumbPart.name)) // This filters out any parts that are numbers (array indices)
      .map(breadcrumbPart => breadcrumbPart.name)
      .join(' > ');

    return {
      obj: match.obj,
      breadcrumbMarkdown: breadcrumbMarkdown, // Markdown links for each breadcrumb part
      breadcrumbPlainText: breadcrumbPlainText // Plain text for each breadcrumb part
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

const keysToRemove = ['__range', '__isarray']

class JBeamHoverProvider {
  provideHover(document, position, token) {
    const text = document.getText();
    const range = document.getWordRangeAtPosition(position);
    const word = document.getText(range);

    const contents = new vscode.MarkdownString();
    contents.isTrusted = true; // Allows for command links and other Markdown features
    //contents.appendMarkdown(`**You are hovering over:** ${word}\n\n`);

    let parsedData = sjsonParser.decodeSJSON(text);
    if(parsedData) {
      // not table unrolled, useful for documentation and alike
      const results = findObjectsWithRange(parsedData, position.line, position.character, document.uri.toString());
      if(results && results.length > 0) {
        let foundObjClean = deepCloneAndRemoveKeys(results[0].obj, keysToRemove)
        contents.appendMarkdown(`#### ${results[0].breadcrumbPlainText} > ${word}\n`);
      }

      // fully unrolled data
      let [tableInterpretedData, diagnostics] = tableSchema.processAllParts(parsedData)
      if(tableInterpretedData) {
        const results = findObjectsWithRange(tableInterpretedData, position.line, position.character, document.uri.toString());
        if(results && results.length > 0) {
          let foundObjClean = deepCloneAndRemoveKeys(results[0].obj, keysToRemove)
          contents.appendMarkdown(`#### ${results[0].breadcrumbMarkdown}\n`);
          contents.appendCodeblock(JSON.stringify(foundObjClean, null, 2), 'json');
        }
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
