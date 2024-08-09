// this file parses the json and table schema and injects warnings and errors into the problem list in vscode
// it does not do any processing of the parsed data

const vscode = require('vscode');
const path = require('path')

const sjsonParser = require('../json/sjsonParser');
const tableSchema = require('../json/tableSchema');
const archivar = require('../archivar');
const utilsExt = require('../utilsExt');

const jbeamDiagnostics = vscode.languages.createDiagnosticCollection('jbeam');

function validateTextDocument(document) {
  if (document.languageId !== 'jbeam') {
    return;
  }

  const diagnosticsList = []
  const contentTextUtf8 = document.getText()

  // generic json things
  let dataBundle
  try {
    dataBundle = sjsonParser.decodeWithMetaWithDiagnostics(contentTextUtf8, document.uri.fsPath, false)
    if(dataBundle) {
        diagnosticsList.push(...dataBundle.diagnosticsList)
    }
  } catch (e) {
    const pos = new vscode.Position(0, 0)
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(pos, pos),
      `Exception while parsing SJSON: ${e.message}`,
      vscode.DiagnosticSeverity.Error
    );
    diagnosticsList.push(diagnostic);
    //throw e
  }

  // jbeam specific things
  let tableInterpretedData
  let diagnosticsTable
  if(dataBundle && diagnosticsList.length === 0) {
    try {
      [tableInterpretedData, diagnosticsTable] = tableSchema.processAllParts(dataBundle.data)
      for (const w of diagnosticsTable) {
        // w[0] = type: error/warning
        // w[1] = message
        // w[2] = range = [linefrom, positionfrom, lineto, positionto]
        let linefrom = 0, positionfrom = 0, lineto = 0, positionto = 0
        if (w[2]) {
          linefrom = w[2][0], positionfrom = w[2][1], lineto = w[2][2], positionto = w[2][3]
        }
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(new vscode.Position(linefrom, positionfrom), new vscode.Position(lineto, positionto)),
          w[1],
          w[0] == 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error
        );
        diagnosticsList.push(diagnostic);
      }
    } catch (e) {
      const pos = new vscode.Position(0, 0)
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(pos, pos),
        `Exception while parsing tables: ${e.message}`,
        vscode.DiagnosticSeverity.Error
      );
      diagnosticsList.push(diagnostic);
      //throw e
    }
  }

  // now specific checks for the language itself. i.e. duplicate beams
  if(tableInterpretedData) {
    const seenBeams = new Set();

    // check duplicate beams
    for (const [partName, part] of Object.entries(tableInterpretedData)) {
      if (part?.beams) {
        for (const beamKey in part.beams) {
          const beam = part.beams[beamKey]
          const [sortedId1, sortedId2] = [beam['id1:'], beam['id2:']].sort();
          const beamIdentifier = `${sortedId1}_${sortedId2}`;
  
          if (seenBeams.has(beamIdentifier)) {
            const range = new vscode.Range(
              new vscode.Position(beam?.__meta?.range[0], beam?.__meta?.range[1]),
              new vscode.Position(beam?.__meta?.range[2], beam?.__meta?.range[3])
            );
            const diagnostic = new vscode.Diagnostic(
              range,
              `Duplicate beam found in part ${partName} with ids: ${sortedId1}, ${sortedId2}`,
              vscode.DiagnosticSeverity.Error
            );
            diagnosticsList.push(diagnostic);
          } else {
            seenBeams.add(beamIdentifier);
          }
        }
      }
      // Check for degenerate triangles
      if (part?.triangles) {
        for (const triangleName in part.triangles) {
          const triangle = part.triangles[triangleName];
          if (typeof triangle === 'object' && triangle['id1:'] && triangle['id2:'] && triangle['id3:']) {
            const id1 = triangle['id1:'];
            const id2 = triangle['id2:'];
            const id3 = triangle['id3:'];
            const sortedNodes = [id1, id2, id3].sort();
  
            // Check if any two nodes are the same, indicating a degenerate triangle
            if (sortedNodes[0] === sortedNodes[1] || sortedNodes[1] === sortedNodes[2]) {
              const range = new vscode.Range(
                new vscode.Position(triangle?.__meta?.range[0], triangle?.__meta?.range[1]),
                new vscode.Position(triangle?.__meta?.range[2], triangle?.__meta?.range[3])
              );
              const diagnostic = new vscode.Diagnostic(
                range,
                `Degenerate triangle found in part ${partName} with nodes: ${id1}, ${id2}, ${id3}`,
                vscode.DiagnosticSeverity.Error
              );
              diagnosticsList.push(diagnostic);
            }
          }
        }
      }
    }
  }

    // Update the diagnostics collection for the file
  jbeamDiagnostics.set(document.uri, diagnosticsList);
}

function subscribeToDocumentChanges(context, diagnostics) {
  // Check the document when it's first opened
  if (vscode.window.activeTextEditor) {
    validateTextDocument(vscode.window.activeTextEditor.document);
  }

  // Check the document when it's changed
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      validateTextDocument(event.document);
    })
  );

  // Clear diagnostics for closed documents
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(doc => jbeamDiagnostics.delete(doc.uri))
  );
}

let completionDisposable
function activate(context) {
  subscribeToDocumentChanges(context, jbeamDiagnostics);
}

function deactivate() {
  jbeamDiagnostics.clear();
  if(completionDisposable) completionDisposable.dispose()
}

module.exports = {
  activate,
  deactivate,
  jbeamDiagnostics
}
