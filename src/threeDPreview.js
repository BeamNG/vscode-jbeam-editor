const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const sjsonParser = require('./sjsonParser');
const tableSchema = require('./tableSchema');
const utilsExt = require('./utilsExt');

let meshCache = {}
let extensionContext // context from activate

// caches parsed data for each document
let docCache = {}
let allWebPanels = []

const highlightDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 255, 0, 0.3)', // yellow background for highlighting
}); 
const fadeDecorationType = vscode.window.createTextEditorDecorationType({
  color: 'rgba(200, 200, 200, 0.5)',
})

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


function onLoadColladaNamespaces(webPanel, uri, loadedNamespaces, loadCommon) {
  // Parse the URI to get the full file system path
  let filePath = vscode.Uri.parse(uri).fsPath;

  // Find the 'vehicles' directory in the path
  let vehiclesPath = filePath
  let vehicleSpecificPath = null
  while (!vehiclesPath.endsWith('vehicles') && path.dirname(vehiclesPath) !== vehiclesPath) {
    if (path.basename(path.dirname(vehiclesPath)) === 'vehicles') {
      vehicleSpecificPath = path.basename(vehiclesPath) // Grab the specific vehicle directory name
    }
    vehiclesPath = path.dirname(vehiclesPath)
  }

  // Check if 'vehicles' was found
  if (!vehiclesPath.endsWith('vehicles')) {
    console.error('The "vehicles" directory was not found in the path.');
    return;
  }

  let findFilesPromises = [];

  // Find .dae files in the common folder
  if(loadCommon && !loadedNamespaces.includes('/vehicles/common')) {
    const commonFolderPath = path.join(vehiclesPath, 'common');
    const commonFolderPattern = new vscode.RelativePattern(commonFolderPath, '**/*.{dae,DAE,dAe,DaE,daE,DAe,daE,dAE}');

    findFilesPromises.push(vscode.workspace.findFiles(commonFolderPattern, null).then(files => {
      files.forEach(file => {
        //console.log(`Found .dae in common folder: ${file.fsPath}`);
        if(webPanel) {
          webPanel.webview.postMessage({
            command: 'loadDaeFinal',
            uri: utilsExt.convertUri(vscode, webPanel, file.fsPath),
            namespace: '/vehicles/common',
          })
        }
      });
    }));
  }

  if(!loadedNamespaces.includes('/vehicles/' + vehicleSpecificPath)) {
    const vehicleSpecificFolderPath = path.join(vehiclesPath, vehicleSpecificPath);
    const vehicleFolderPattern = new vscode.RelativePattern(vehicleSpecificFolderPath, '**/*.{dae,DAE,dAe,DaE,daE,DAe,daE,dAE}');
    findFilesPromises.push(vscode.workspace.findFiles(vehicleFolderPattern, null).then(files => {
      files.forEach(file => {
        //console.log(`Found .dae in vehicle specific folder: ${file.fsPath} > ${utilsExt.convertUri(vscode, webPanel, file.fsPath)}`);
        if(webPanel) {
          webPanel.webview.postMessage({
            command: 'loadDaeFinal',
            uri: utilsExt.convertUri(vscode, webPanel, file.fsPath),
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


function getWebviewContent(webPanel) {
  if(!webPanel || webPanel.is) return null
  const webviewPath = path.join(extensionContext.extensionPath, 'webview', 'index_vscode.html');
  let content = fs.readFileSync(webviewPath, 'utf8');
  content = content.replace(/<!-- LocalResource:(.*?) -->/g, (match, resourceName) => {
    return webPanel.webview.asWebviewUri(vscode.Uri.file(path.join(extensionContext.extensionPath, 'webview', resourceName)));
  });
  return content;
}

function show3DSceneCommand() {
  const config = vscode.workspace.getConfiguration('jbeam-editor')
  // Create and show a new webview
  let webPanel = vscode.window.createWebviewPanel(
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
  webPanel.onDidDispose(() => { 
    allWebPanels = allWebPanels.filter(panel => panel !== webPanel);
    webPanel = null
  }, null, extensionContext.subscriptions)
  allWebPanels.push(webPanel)
  extensionContext.subscriptions.push(webPanel)

  // now start the 3d scene in the webpanel :)
  // this needs to happen before we send any data over
  webPanel.webview.postMessage({
    command: 'init',
    config: JSON.stringify(config)
  })

  function onResetSelection(message) {
    let targetEditor = vscode.window.visibleTextEditors.find(editor => {
      return editor.document.uri.toString() === message.uri;
    });

    if (targetEditor) {
      targetEditor.setDecorations(highlightDecorationType, []);
      targetEditor.setDecorations(fadeDecorationType, []);    
    }
  }

  function onGoToLineAndDecorate(message) {
    let targetEditor = vscode.window.visibleTextEditors.find(editor => {
      return editor.document.uri.toString() === message.uri;
    });

    if (targetEditor) {
      const start = new vscode.Position(message.range[0], message.range[1]);
      const end = new vscode.Position(message.range[2], message.range[3]);
      const highlightRange = new vscode.Range(start, end);

      // Apply the highlight and fade effects
      applyFadeEffectToDocument(targetEditor, highlightRange)

      // Go to the line and reveal it in the center of the viewport
      targetEditor.selection = new vscode.Selection(start, start);
      targetEditor.revealRange(highlightRange, vscode.TextEditorRevealType.InCenter);
    } else {
      // settings might be open, silently ignore this
      //console.error('3d-onGoToLineAndDecorate - Editor for uri not found: ', message.uri);
    }
  }

  let openedFromTextEditor = vscode.window.activeTextEditor

  webPanel.webview.onDidReceiveMessage(
    message => {
      //console.log('ext.onDidReceiveMessage', message)
      switch (message.command) {
        case 'selectLine':
          onGoToLineAndDecorate(message);
          break;
        case 'resetSelection':
          onResetSelection(message);
          break;
        case 'loadColladaNamespaces':
          onLoadColladaNamespaces(webPanel, message.uri, message.data, message.loadCommon)
          break
        case 'loadDae':
          // this converts any file requests to proper URIs that can load inside the webview.
          // the sandbox does not allow any direct file interaction, so this indirection is required
          webPanel.webview.postMessage({
            command: 'loadDaeFinal',
            uri: utilsExt.convertUri(vscode, webPanel, path.join(extensionContext.extensionPath, 'webview', message.path)),
          });
          break;
        case 'updateMeshCache':
          Object.assign(meshCache, message.data)
          break
        // sent once the 3d scene finished loading
        case 'sceneReady':
          // send over the data of the active text document
          if (openedFromTextEditor) {
            parseAndPostData(openedFromTextEditor.document);
          }
          break
        }
    },
    undefined,
    extensionContext.subscriptions
  );

  function parseAndPostData(doc, updatedOnly = false) {
    if(!webPanel) return

    let meshLoadingEnabled = false
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      meshLoadingEnabled = false
    } else {
      if(workspaceFolders.some(folder => { return doc.uri.fsPath.startsWith(folder.uri.fsPath) })) {
        meshLoadingEnabled = true
      }
    }

    if(!meshLoadingEnabled) {
      vscode.window.showErrorMessage('In order to load 3D Meshes, the open file must be part of a workspace.');
    }

    const text = doc.getText()
    const uri = doc.uri.toString()
    try {
      let parsedData = sjsonParser.decodeSJSON(text);
      if(!parsedData) {
        console.error("Could not parse SJSON!")
        return
      }
      let [tableInterpretedData, diagnosticsTable] = tableSchema.processAllParts(parsedData)
      docCache[uri] = tableInterpretedData

      webPanel.webview.postMessage({
        command: 'jbeamData',
        data: tableInterpretedData,
        uri: uri,
        meshCache: meshCache,
        updatedOnly: updatedOnly,
        meshLoadingEnabled: meshLoadingEnabled,
      });
    } catch (e) {
      // If there's an error in parsing, show it to the user
      vscode.window.showErrorMessage(`Error parsing SJSON: ${e.message}`);
      throw e
    }
  }
  // Listen for when the active editor changes
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      parseAndPostData(editor.document);
    }
  })
  // Listen for changes in the document of the active editor
  vscode.workspace.onDidChangeTextDocument(event => {
    if (vscode.window.activeTextEditor && webPanel && webPanel.visible && event.document === vscode.window.activeTextEditor.document) {
      parseAndPostData(event.document, true);
    }
  });
  vscode.window.onDidChangeTextEditorSelection(event => {
    if (vscode.window.activeTextEditor && event.textEditor === vscode.window.activeTextEditor) {
      const uri = event.textEditor.document.uri.toString()
      const range = [event.selections[0].start.line, event.selections[0].start.character, event.selections[0].end.line, event.selections[0].end.character]

      // find the part the cursor is in
      let partNameFound = null
      if(docCache[uri]) {
        const data = docCache[uri]
        for (let partName in data) {
          if (range[0] >= data[partName].__range[0] && range[0] <= data[partName].__range[2]) {
            partNameFound = partName
            break
          }
        }
      }
      if (webPanel && webPanel.visible) {
        webPanel.webview.postMessage({
          command: 'cursorChanged',
          currentPartName: partNameFound,
          range: range
        });
      }
    }
  })

  // Listen for document closures
  vscode.workspace.onDidCloseTextDocument(document => {
    const uri = document.uri.toString()
    if(docCache[uri]) {
      delete docCache[uri]
    }
  })
}

let show3DSceneCommandDisposable
function activate(context) {
  extensionContext = context
  show3DSceneCommandDisposable = vscode.commands.registerCommand('jbeam-editor.show3DScene', show3DSceneCommand);
  extensionContext.subscriptions.push(show3DSceneCommandDisposable)

  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('jbeam-editor')) {
      const config = vscode.workspace.getConfiguration('jbeam-editor')
      for(let w of allWebPanels) {
        if(!w || !w.webview) continue
        w.webview.postMessage({
          command: 'config',
          config: JSON.stringify(config)
        })
      }
    }
  }))
}

function deactivate() {
  // we dispose explicitly as we reload these modules on config change
  if(show3DSceneCommandDisposable) show3DSceneCommandDisposable.dispose()
}

module.exports = {
  activate: activate,
  deactivate: deactivate,
}