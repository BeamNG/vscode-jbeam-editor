// this file provides symbols for vscode so the outline on the left bar is working

const vscode = require('vscode');
const sjsonParser = require('../json/sjsonParser');
const tableSchema = require('../json/tableSchema');
const utilsExt = require('../utilsExt');

class JBeamSymbolProvider {
  provideDocumentSymbols(document, token) {
    const symbols = [];

    const contentTextUtf8 = document.getText()

    let dataBundle = sjsonParser.decodeWithMeta(contentTextUtf8, document.uri.fsPath)
    if(!dataBundle) {
      console.log('unable to get data from document: ', document.uri.fsPath, text)
      return
    }

    let [tableInterpretedData, diagnostics] = tableSchema.processAllParts(dataBundle.data)

    for (const [partName, part] of Object.entries(tableInterpretedData)) {
      if(partName === '__meta' || part.__meta === undefined) continue
      const range = new vscode.Range(
        new vscode.Position(part.__meta.range[0], part.__meta.range[1]),
        new vscode.Position(part.__meta.range[2], part.__meta.range[3])
      )

      let infoText = ''
      let partNameInfo = ''
      let partAuthorInfo = ''
      let partNameOutline = partName
      if(part.information) {
        partNameInfo = part.information.name ? part.information.name : ""
        partAuthorInfo = part.information.authors ? part.information.authors : ""
      }
      infoText = `- ${partAuthorInfo}`
      if(partName != partNameInfo) {
        partNameOutline = `${partName} [${partNameInfo}]`
      } else {
        partNameOutline = `${partName}`
      }

      const symbol = new vscode.DocumentSymbol(
        partNameOutline,
        infoText,
        vscode.SymbolKind.Object,
        range,
        range
      );

      for (const [sectionName, section] of Object.entries(part)) {
        if(sectionName === '__meta' || !section.__meta) continue
        const range = new vscode.Range(
          new vscode.Position(section.__meta.range[0], section.__meta.range[1]),
          new vscode.Position(section.__meta.range[2], section.__meta.range[3])
        )
        let infoText = ''
        if(true) {
          infoText += Object.keys(section).filter(key => key !== '__meta').length
        }
        const subSymbol = new vscode.DocumentSymbol(
          sectionName,
          infoText,
          section.__meta.type == 'array' ? vscode.SymbolKind.Array : vscode.SymbolKind.Object,
          range,
          range
        )
        symbol.children.push(subSymbol)
      }

      symbols.push(symbol);
    }
    return symbols;
  }
}

let symbolProviderDisposable
function activate(context) {
  symbolProviderDisposable = vscode.languages.registerDocumentSymbolProvider(
    { language: 'jbeam' },
    new JBeamSymbolProvider(symbolProviderDisposable)
  )
  context.subscriptions.push()
}

function deactivate() {
  // we dispose explicitly as we reload these modules on config change
  if(symbolProviderDisposable) symbolProviderDisposable.dispose()
}

module.exports = {
  activate,
  deactivate
}

