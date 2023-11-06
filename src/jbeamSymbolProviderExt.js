/**
 * JBeam Symbol Provider for Visual Studio Code
 * 
 * This file defines a symbol provider for JBeam files, which are structured
 * in SJSON (strict JSON). The symbol provider enables the Outline view in VS Code,
 * allowing users to see a hierarchical view of the parts and sections defined in a JBeam file.
 * 
 * It leverages a custom SJSON parser to decode the JBeam file content and a table schema
 * processor to interpret the structured data for VS Code's symbol API.
 * 
 * Key Features:
 * - Parses JBeam files using an SJSON parser to handle the custom format.
 * - Interprets the parsed data against a predefined table schema, mapping it to symbols.
 * - Skips irrelevant keys like '__range' and '__isarray' during symbol generation.
 * - Generates a hierarchical symbol tree, with parts as root symbols and sections as children.
 * - Provides additional info in the Outline view, such as part names and authorship, where available.
 * - Registers itself as a document symbol provider for the 'jbeam' language in VS Code.
 * 
 * Usage:
 * - The file must be included in a VS Code extension that supports JBeam language features.
 * - Upon opening a JBeam file in VS Code, the outline view will be populated with symbols.
 * - Activating the extension will invoke this symbol provider to parse and display symbols.
 * - Deactivating the extension will clear the diagnostics and symbols from the editor.
 */
const vscode = require('vscode');
const sjsonParser = require('./sjsonParser');
const tableSchema = require('./tableSchema');

const excludedKeys = ['__range', '__isarray'];

class JBeamSymbolProvider {
  provideDocumentSymbols(document, token) {
    const symbols = [];

    const text = document.getText()
    let parsedData = sjsonParser.decodeSJSON(text);
    let [tableInterpretedData, diagnostics] = tableSchema.processAllParts(parsedData)

    for (const [partName, part] of Object.entries(tableInterpretedData)) {
      if(!part.__range) continue
      const range = new vscode.Range(
        new vscode.Position(part.__range[0] - 1, part.__range[1] - 1),
        new vscode.Position(part.__range[2] - 1, part.__range[3] - 1)
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
        if(sectionName === '__isarray' || sectionName === '__range' || !section.__range) continue
        const range = new vscode.Range(
          new vscode.Position(section.__range[0] - 1, section.__range[1] - 1),
          new vscode.Position(section.__range[2] - 1, section.__range[3] - 1)
        )
        let infoText = ''
        if(true) {
          infoText += Object.keys(section).filter(key => !excludedKeys.includes(key)).length
        }
        const subSymbol = new vscode.DocumentSymbol(
          sectionName,
          infoText,
          section.__isarray ? vscode.SymbolKind.Array : vscode.SymbolKind.Object,
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

function activate(context) {
  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(
    { language: 'jbeam' },
    new JBeamSymbolProvider()
  ));
}

function deactivate() {
  jbeamDiagnostics.clear();
}

module.exports = {
  activate,
  deactivate
}

