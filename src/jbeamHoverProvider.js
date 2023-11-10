const vscode = require('vscode');
const sjsonParser = require('./sjsonParser');
const tableSchema = require('./tableSchema');
const utilsExt = require('./utilsExt');
const docHelper = require('./docHelper');

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

    if(vscode.workspace.getConfiguration('jbeam-editor').get('hover.highlightBreadCrumb')) {
      applyFadeEffectToDocument(targetEditor, highlightRange)
    }

    // Go to the line and reveal it in the center of the viewport
    targetEditor.selection = new vscode.Selection(start, start);
    targetEditor.revealRange(highlightRange, vscode.TextEditorRevealType.InCenter);
  } else {
    console.error('Editor for uri not found: ', args.uri);
  }
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

function getKeyByValueStringComparison(object, value) {
  return Object.keys(object).find(key => String(object[key]) === value);
}

// this is the same as `document.getWordRangeAtPosition(position);` but it parses $ as well.
// this is needed as we use $ for variables in JBeam
// TODO: improve to parse anything in quotes first, then fall back to this version
function getWordRangeAtPositionIncludingDollar(document, position) {
  const text = document.lineAt(position.line).text;
  const wordPattern = /[\w$]+/g; // This regex includes word characters and the $ symbol

  let wordRange;
  let match;
  while ((match = wordPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (start <= position.character && position.character <= end) {
      wordRange = new vscode.Range(position.line, start, position.line, end);
      break;
    }
  }

  return wordRange;
}

function getDocEntry(key) {
  let res = docHelper.jbeamDocumentation[key]
  if(typeof res === 'object') {
    let resText = ''
    for (let k in res) {
      let v = res[k]
      if(k === 'description') {
        resText += v + "\n\n"
      } else {
        resText += '* **' + k + '**: ' + v + "\n\n"
      }
    }
    return resText
  }
  return docHelper.jbeamDocumentation[key]
}

class JBeamHoverProvider {
  provideHover(document, position, token) { // token = CancellationToken
    const text = document.getText();
    const range = getWordRangeAtPositionIncludingDollar(document, position) // document.getWordRangeAtPosition(position);
    const word = document.getText(range);

    const contents = new vscode.MarkdownString();
    contents.isTrusted = true; // Allows for command links and other Markdown features
    //contents.appendMarkdown(`**You are hovering over:** ${word}\n\n`);

    const showFullDevData = vscode.workspace.getConfiguration('jbeam-editor').get('hover.dev.showFullDevData')

    let docHints = []
    let parsedData = sjsonParser.decodeSJSON(text);
    if(parsedData) {
      // not table unrolled, useful for documentation and alike
      const resultsRawData = utilsExt.findObjectsWithRange(parsedData, position.line, position.character, document.uri.toString());
      let foundObjCleanRaw
      if(resultsRawData && resultsRawData.length > 0) {
        foundObjCleanRaw = deepCloneAndRemoveKeys(resultsRawData[0].obj, showFullDevData ? [] : utilsExt.excludedMagicKeys)
      }

      // fully unrolled data
      let [tableInterpretedData, diagnostics] = tableSchema.processAllParts(parsedData)
      let resultsStructuredData
      let foundObjCleanStructured
      let wasBlockMerged = false
      if(tableInterpretedData) {
        resultsStructuredData = utilsExt.findObjectsWithRange(tableInterpretedData, position.line, position.character, document.uri.toString());
        if(resultsStructuredData && resultsStructuredData.length > 0) {
          foundObjCleanStructured = deepCloneAndRemoveKeys(resultsStructuredData[0].obj, showFullDevData ? [] : utilsExt.excludedMagicKeys)
          // check for removed entries
          wasBlockMerged = !(resultsStructuredData && resultsStructuredData && (resultsRawData.length - 2 < resultsStructuredData.length))
          // this element was present in the raw data and merged in the structured version, so it's gone ...
        }
      }

      const showDocs = vscode.workspace.getConfiguration('jbeam-editor').get('hover.showDocs')
      const showDocHints = vscode.workspace.getConfiguration('jbeam-editor').get('hover.dev.showDocHints')

      if(showDocs || showDocHints) {
        // no try to get the docs with both data being present ...
        if(resultsRawData && resultsRawData.length > 0) {
          const shortWord = word.slice(0, 40) // because there can be a lot of garbage in there, like half the document ...
          const finalBreadCrumb = (`${resultsRawData[0].breadcrumbPlainText} > ${shortWord}`)
          docHints.push(finalBreadCrumb)
          let doc = getDocEntry(finalBreadCrumb)
          if(showDocs && doc) {
            contents.appendMarkdown(`## Documentation\n### ${finalBreadCrumb}\n\n`);
            contents.appendMarkdown(doc + '\n\n');
          } else {
            // try to find the key of the thing hovered
            let keyOfEntry
            if(foundObjCleanStructured) {
              keyOfEntry = getKeyByValueStringComparison(foundObjCleanStructured, shortWord)
              if(!keyOfEntry) {
                keyOfEntry = getKeyByValueStringComparison(foundObjCleanRaw, shortWord)
              }
              if(keyOfEntry && resultsStructuredData && resultsStructuredData.length > 0) {
                keyOfEntry = keyOfEntry.replace(/:.*$/, ''); // remove trailing : for the docs ... - btw, this is the namespace separator and empty means 'nodes'
                keyOfEntry = `${resultsStructuredData[0].breadcrumbPlainText} > ${keyOfEntry}`
                docHints.push(keyOfEntry)
                doc = getDocEntry(keyOfEntry)
                if(showDocs && doc) {
                  contents.appendMarkdown(`## Documentation\n### ${keyOfEntry}\n\n`);
                  contents.appendMarkdown(doc + '\n\n');
                }
              }
            }
            if(!doc) {
              // retry with the word only
              docHints.push(keyOfEntry)
              doc = getDocEntry(shortWord)
              if(showDocs && doc) {
                contents.appendMarkdown(`## Documentation\n### ${shortWord}\n\n`);
                contents.appendMarkdown(doc + '\n\n');
              }
            }
          }
        }
      }

      // now add the data if available
      if(vscode.workspace.getConfiguration('jbeam-editor').get('hover.showData')) {
        if(resultsStructuredData) {
          if(!wasBlockMerged && foundObjCleanStructured) {
            const text = JSON.stringify(foundObjCleanStructured, null, 2)
            if(text.length < 32768) {
              contents.appendMarkdown(`## Data\n\n ${resultsStructuredData[0].breadcrumbMarkdown}\n`)
              contents.appendCodeblock(JSON.stringify(foundObjCleanStructured, null, 2), 'json')
            }
          } else {
            contents.appendMarkdown(`Object contained in ${resultsStructuredData[0].breadcrumbMarkdown}\n`)
          }
        }
      }

      if(showDocHints && docHints.length > 0) {
        docHints = docHints.filter(content => !/[{}]/.test(content));
        if(docHints.length > 0) {
          contents.appendMarkdown('#### Documentation hints\n\n')
          for(let dh of docHints) {
            contents.appendMarkdown(' * `' + dh + '`\n\n')
          }
        }
      }

    }




    return new vscode.Hover(contents, range);
  }
}

let gotoLineDisposable
let hoverProviderDisposable
function activate(context) {
  let config = vscode.workspace.getConfiguration('jbeam-editor')
  if(config.get('hover.enabled')) {
    hoverProviderDisposable = vscode.languages.registerHoverProvider(
      { language: 'jbeam' },
      new JBeamHoverProvider()
    )
    context.subscriptions.push(hoverProviderDisposable)
  }

  gotoLineDisposable = vscode.commands.registerCommand('jbeam-editor.gotoLine', goToLineForHover)
  context.subscriptions.push();
}

function deactivate() {
  // we dispose explicitly as we reload these modules on config change
  if(gotoLineDisposable) gotoLineDisposable.dispose()
  if(hoverProviderDisposable) hoverProviderDisposable.dispose()
}

module.exports = {
  activate,
  deactivate
}
