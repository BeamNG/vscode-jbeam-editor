// this file provides hover tooltips
const vscode = require('vscode');
const sjsonParser = require('../json/sjsonParser');
const tableSchema = require('../json/tableSchema');
const utilsExt = require('../utilsExt');
const docHelper = require('../docHelper');

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

    if(vscode.workspace.getConfiguration('jbeam-editor').get('hover.highlightBreadCrumb', false)) {
      applyFadeEffectToDocument(targetEditor, highlightRange)
    }

    // Go to the line and reveal it in the center of the viewport
    targetEditor.selection = new vscode.Selection(start, start);
    targetEditor.revealRange(highlightRange, vscode.TextEditorRevealType.InCenter);
  } else {
    // settings might be open, silently ignore this
    //console.error('hover-goToLineForHover: Editor for uri not found: ', args.uri);
  }
}

function getDocEntry(key) {
  let d = docHelper.jbeamDocumentation[key];
  if (typeof d === 'object') {
    let res = '<span style="margin:5px;width:150px;"><b>Documentation</b><br/>'
    res += `$(type-hierarchy-sub) ${key}<br/>`
    res += `$(book) ${d.description}<br/>`
    let ticon = ''

    if(d.type == 'number') ticon = '$(symbol-numeric)'
    else if(d.type == 'boolean') ticon = '$(symbol-boolean)'
    else if(d.type == 'string') ticon = '$(symbol-string)'
    if(d.default === '') d.default = '<empty>'
    res += `${ticon} ${d.type} (default: ${d.default})<br/>`

    res += `$(notebook) ${d.documentation}<br/>`

    res += '</span><br/>'
    return res
  }
  return null
}

class JBeamHoverProvider {
  provideHover(document, position, token) { // token = CancellationToken
    const contentTextUtf8 = document.getText();
    const range = document.getWordRangeAtPosition(position, /[^\",]+/)
    const word = document.getText(range);

    const contents = new vscode.MarkdownString();
    contents.isTrusted = true
    contents.supportHtml = true
    contents.supportThemeIcons = true
    //contents.appendMarkdown(`**You are hovering over:** ${word}\n\n`);

    const showFullDevData = vscode.workspace.getConfiguration('jbeam-editor').get('hover.dev.showFullDevData', false)

    let docHints = []
    let dataBundle = sjsonParser.decodeWithMeta(contentTextUtf8, document.uri.fsPath)
    if(dataBundle) {


      let metaRaw = sjsonParser.getMetaForCurAnyData(dataBundle.data, position.line, position.character, document.uri, 'raw', 1)
      if(!metaRaw || metaRaw.length == 0) {
        console.log('unable to get data below cursor: ', document.uri.fsPath, text, position)
        return
      }

      // fully unrolled data
      let [tableInterpretedData, diagnostics] = tableSchema.processAllParts(dataBundle.data)

      let foundObjCleanStructured
      let metaStructured
      let wasBlockMerged = false
      if(tableInterpretedData) {
        metaStructured = sjsonParser.getMetaForCurAnyData(tableInterpretedData, position.line, position.character, document.uri, 'structured', 1)
        if(metaStructured && metaStructured.length > 0) {
          foundObjCleanStructured = utilsExt.deepCloneAndRemoveKeys(metaStructured[0].objStructured, showFullDevData ? [] : ['__meta'])
          // check for removed entries
          wasBlockMerged = !(metaStructured && (metaRaw.length - 2 < metaStructured.length))
          // this element was present in the raw data and merged in the structured version, so it's gone ...
        }
      }

      const showDocs = vscode.workspace.getConfiguration('jbeam-editor').get('hover.showDocs', true)
      const showDocHints = vscode.workspace.getConfiguration('jbeam-editor').get('hover.dev.showDocHints', false)

      if(showDocs || showDocHints) {
        // no try to get the docs with both data being present ...
        if(metaRaw && metaRaw.length > 0) {
          const shortWord = word.slice(0, 40).trim() // because there can be a lot of garbage in there, like half the document ...
          const finalBreadCrumb = (`${metaRaw[0].breadcrumbPlainText} > ${shortWord}`)
          docHints.push(finalBreadCrumb)
          let doc = getDocEntry(finalBreadCrumb)
          if(showDocs && doc) {
            contents.appendMarkdown(doc)
          } else {
            // try to find the key of the thing hovered

            // TODO
            /*
            let keyOfEntry
            if(foundObjCleanStructured) {
              keyOfEntry = utilsExt.getKeyByValueStringComparison(foundObjCleanStructured, shortWord)
              if(!keyOfEntry) {
                keyOfEntry = utilsExt.getKeyByValueStringComparison(foundObjCleanRaw, shortWord)
              }
              if(keyOfEntry && metaStructured && metaStructured.length > 0) {
                keyOfEntry = keyOfEntry.replace(/:.*$/, ''); // remove trailing : for the docs ... - btw, this is the namespace separator and empty means 'nodes'
                keyOfEntry = `${metaStructured[0].breadcrumbPlainText} > ${keyOfEntry}`
                docHints.push(keyOfEntry)
                doc = getDocEntry(keyOfEntry)
                if(showDocs && doc) {
                  contents.appendMarkdown(doc)
                }
              }
            }
            if(!doc) {
              // retry with the word only
              docHints.push(keyOfEntry)
              doc = getDocEntry(shortWord)
              if(showDocs && doc) {
                contents.appendMarkdown(doc)
              }
            }
            */
          }
        }
      }

      // now add the data if available
      if(vscode.workspace.getConfiguration('jbeam-editor').get('hover.showData', true)) {
        if(metaStructured) {
          if(!wasBlockMerged && foundObjCleanStructured) {
            const text = JSON.stringify(foundObjCleanStructured, null, 2)
            if(text.length < 32768) {
              contents.appendMarkdown(`<span style="margin:5px;width:150px;"><b>Data</b><br/>$(type-hierarchy-sub)${metaStructured[0].breadcrumbsMarkdown.structured}<br/>`)
              contents.appendCodeblock(JSON.stringify(foundObjCleanStructured, null, 2), 'json')
              contents.appendMarkdown('</span><br/>')
            }
          } else {
            contents.appendMarkdown(`<span style="margin:5px;width:150px;"><b>Data</b><br/>$(type-hierarchy-sub)${metaStructured[0].breadcrumbsMarkdown.structured}</span><br/>`)
          }
        }
      }

      if(showDocHints && docHints.length > 0) {
        docHints = docHints.filter(content => !/[{}]/.test(content));
        if(docHints.length > 0) {
          contents.appendMarkdown('<span style=""><b>Documentation hints</b><br/><ul>')
          for(let dh of docHints) {
            contents.appendMarkdown('<li>`' + dh + '`</li>')
          }
          contents.appendMarkdown('<ul></span><br/>')
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
