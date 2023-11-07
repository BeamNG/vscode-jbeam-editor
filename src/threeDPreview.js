const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const sjsonParser = require('./sjsonParser');
const tableSchema = require('./tableSchema');

let webPanel
let meshCache = {}
let extensionContext

function convertUri(filePath) {
  const uri = vscode.Uri.file(filePath);
  const webviewUri = webPanel.webview.asWebviewUri(uri);
  return webviewUri.toString()
}

function loadColladaNamespaces(uri, loadedNamespaces) {
  // Parse the URI to get the full file system path
  let filePath = vscode.Uri.parse(uri).fsPath;

  // Find the 'vehicles' directory in the path
  let vehiclesPath = filePath;
  let vehicleSpecificPath = null;
  while (!vehiclesPath.endsWith('vehicles') && path.dirname(vehiclesPath) !== vehiclesPath) {
    if (path.basename(path.dirname(vehiclesPath)) === 'vehicles') {
      vehicleSpecificPath = path.basename(vehiclesPath); // Grab the specific vehicle directory name
    }
    vehiclesPath = path.dirname(vehiclesPath);
  }

  // Check if 'vehicles' was found
  if (!vehiclesPath.endsWith('vehicles')) {
    console.error('The "vehicles" directory was not found in the path.');
    return;
  }

  let findFilesPromises = [];

  // Find .dae files in the common folder
  if(!loadedNamespaces.includes('/vehicles/common/')) {
    const commonFolderPath = path.join(vehiclesPath, 'common');
    const commonFolderPattern = new vscode.RelativePattern(commonFolderPath, '**/*.{dae,DAE,dAe,DaE,daE,DAe,daE,dAE}');

    findFilesPromises.push(vscode.workspace.findFiles(commonFolderPattern, null, 100).then(files => {
      files.forEach(file => {
        //console.log(`Found .dae in common folder: ${file.fsPath}`);
        if(webPanel) {
          webPanel.webview.postMessage({
            command: 'loadDaeFinal',
            uri: convertUri(file.fsPath),
            namespace: '/vehicles/common/',
          })
        }
      });
    }));
  }

  if(!loadedNamespaces.includes('/vehicles/' + vehicleSpecificPath)) {
    const vehicleSpecificFolderPath = path.join(vehiclesPath, vehicleSpecificPath);
    const vehicleFolderPattern = new vscode.RelativePattern(vehicleSpecificFolderPath, '**/*.{dae,DAE,dAe,DaE,daE,DAe,daE,dAE}');
    findFilesPromises.push(vscode.workspace.findFiles(vehicleFolderPattern, null, 100).then(files => {
      files.forEach(file => {
        //console.log(`Found .dae in vehicle specific folder: ${file.fsPath} > ${convertUri(file.fsPath)}`);
        if(webPanel) {
          webPanel.webview.postMessage({
            command: 'loadDaeFinal',
            uri: convertUri(file.fsPath),
            namespace: '/vehicles/' + vehicleSpecificPath,
          })
        }
      });
    }));
  }
  Promise.all(findFilesPromises).then(allFilesArrays => {
    //console.log("Find files done!")
    if(webPanel) {
      webPanel.webview.postMessage({
        command: 'daeFileLoadingDone',
      })
    }
  })
}


const highlightDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 255, 0, 0.3)', // yellow background for highlighting
});  
const fadeDecorationType = vscode.window.createTextEditorDecorationType({
  color: 'rgba(200, 200, 200, 0.5)',
});

function getWebviewContent(webPanel) {
  if(!webPanel) return null
  const webviewPath = path.join(extensionContext.extensionPath, 'webview', 'index.html');
  let content = fs.readFileSync(webviewPath, 'utf8');
  content = content.replace(/<!-- LocalResource:(.*?) -->/g, (match, resourceName) => {
    return webPanel.webview.asWebviewUri(vscode.Uri.file(path.join(extensionContext.extensionPath, 'webview', resourceName)));
  });
  return content;
}

function show3DSceneCommand() {
  // Create and show a new webview
  webPanel = vscode.window.createWebviewPanel(
    'sceneView', // Identifies the type of the webview
    '3D Scene View', // Title of the panel displayed to the user
    vscode.ViewColumn.Beside, // Editor column to show the new webview panel in
    {
      enableScripts: true,  // Allow scripts to run in the webview
      retainContextWhenHidden: true,  // Optionally, you can retain the state even when webview is not visible
      //localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'webview'))]
    }
  )
  webPanel.webview.html = getWebviewContent(webPanel);
  // Handle the webview being disposed (closed by the user)
  webPanel.onDidDispose(() => { webPanel = null; }, null, extensionContext.subscriptions);  

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
    editor.setDecorations(fadeDecorationType, rangesToFade);
  
    // Set the highlight decoration for the range to be highlighted
    editor.setDecorations(highlightDecorationType, [rangeToHighlight]);
  }

  function resetSelection(message) {
    let targetEditor = vscode.window.visibleTextEditors.find(editor => {
      return editor.document.uri.toString() === message.uri;
    });

    if (targetEditor) {
      targetEditor.setDecorations(highlightDecorationType, []);
      targetEditor.setDecorations(fadeDecorationType, []);    
    }
  }

  function goToLineAndDecorate(message) {
    let targetEditor = vscode.window.visibleTextEditors.find(editor => {
      return editor.document.uri.toString() === message.uri;
    });

    if (targetEditor) {
      const start = new vscode.Position(message.range[0], message.range[1]);
      const end = new vscode.Position(message.range[2], message.range[3]);
      const highlightRange = new vscode.Range(start, end);

      // Apply the highlight and fade effects
      applyFadeEffectToDocument(targetEditor, highlightRange);

      // Go to the line and reveal it in the center of the viewport
      targetEditor.selection = new vscode.Selection(start, start);
      targetEditor.revealRange(highlightRange, vscode.TextEditorRevealType.InCenter);
    } else {
      console.error('Editor for uri not found: ', message.uri);
    }
  }

  webPanel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'selectLine':
          goToLineAndDecorate(message);
          break;
        case 'resetSelection':
          resetSelection(message);
          break;
        case 'loadColladaNamespaces':
          loadColladaNamespaces(message.uri, message.data)
          break
        case 'loadDae':
          // this converts any file requests to proper URIs that can load inside the webview.
          // the sandbox does not allow any direct file interaction, so this indirection is required
          const uri = vscode.Uri.file(path.join(extensionContext.extensionPath, 'webview', message.path));
          const webviewUri = webPanel.webview.asWebviewUri(uri);
          //console.log(">loadDae> ", message.path, webviewUri.toString())
          webPanel.webview.postMessage({
            command: 'loadDaeFinal',
            uri: webviewUri.toString(),
          });
          break;
          case 'updateMeshCache':
            Object.assign(meshCache, message.data)
            break
        }
    },
    undefined,
    extensionContext.subscriptions
  );

  function parseAndPostData(doc, updatedOnly = false) {
    if(!webPanel) return
    const text = doc.getText()
    const uri = doc.uri.toString()
    try {
      let parsedData = sjsonParser.decodeSJSON(text);
      //console.log("PARSED:", parsedData);
      let [tableInterpretedData, diagnostics] = tableSchema.processAllParts(parsedData)

      // Do something with the parsed data, like show it in an information message
      //vscode.window.showInformationMessage('Document parsed successfully. Check the console for the data.');
      //console.log("table expanded:", parsedData);
      webPanel.webview.postMessage({
        command: 'jbeamData',
        data: tableInterpretedData,
        uri: uri,
        meshCache: meshCache,
        updatedOnly: updatedOnly,
      });
    } catch (e) {
      // If there's an error in parsing, show it to the user
      vscode.window.showErrorMessage(`Error parsing SJSON: ${e.message}`);
    }
  }

  // Listen for when the active editor changes
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      parseAndPostData(editor.document);
    }
  });

  // Listen for changes in the document of the active editor
  vscode.workspace.onDidChangeTextDocument(event => {
    if (webPanel.visible && event.document === vscode.window.activeTextEditor.document) {
      parseAndPostData(event.document, true);
    }
  });

  // Initial parse and post
  if (vscode.window.activeTextEditor) {
    parseAndPostData(vscode.window.activeTextEditor.document);
  }

  vscode.window.onDidChangeTextEditorSelection(event => {
    if (event.textEditor === vscode.window.activeTextEditor) {
      if (webPanel && webPanel.visible) {
        webPanel.webview.postMessage({
          command: 'cursorChanged',
          line: event.selections[0].start.line,
          col: event.selections[0].start.character,
        });
      }
    }
  });
}

function activate(context) {
  extensionContext = context
  extensionContext.subscriptions.push(vscode.commands.registerCommand('jbeam-editor.show3DScene', show3DSceneCommand));

  vscode.window.onDidChangeTextEditorSelection(event => {
    if(!webPanel) return
    if (event.textEditor === vscode.window.activeTextEditor) {
      let line = event.selections[0].start.line;
      let text = event.textEditor.document.lineAt(line).text;
      // Send this text to your webview

      webPanel.webview.postMessage({
        command: 'update',
        text: text
      });
    }
  });
}

module.exports = {
  activate: activate,
}