const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "jbeam-editor" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('jbeam-editor.helloWorld', function () {
    // The code you place here will be executed every time your command is executed

    // Display a message box to the user
    vscode.window.showInformationMessage('Hello World from Jbeam editor!');
  });

  context.subscriptions.push(disposable);


  let webPanel
  let disposable2 = vscode.commands.registerCommand('jbeam-editor.show2DScene', function () {
    // Create and show a new webview
    webPanel = vscode.window.createWebviewPanel(
      'sceneView', // Identifies the type of the webview
      '2D Scene View', // Title of the panel displayed to the user
      vscode.ViewColumn.Beside, // Editor column to show the new webview panel in
      {
        enableScripts: true,  // Allow scripts to run in the webview
        retainContextWhenHidden: true,  // Optionally, you can retain the state even when webview is not visible
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'webview'))]
      }
    );

    // And set its HTML content
    webPanel.webview.html = getWebviewContent(webPanel);
  });

  context.subscriptions.push(disposable2);

  vscode.window.onDidChangeTextEditorSelection(event => {
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

function getWebviewContent(webPanel) {
  const webviewPath = path.join(__dirname, 'webview', 'index.html');
  let content = fs.readFileSync(webviewPath, 'utf8');
  
  // Convert the paths for your scripts (or any other resources) to webview URIs
  const threeJsPath = webPanel.webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, 'webview', 'three.min.js')));
  const orbitControlsPath = webPanel.webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, 'webview', 'OrbitControls.js')));

  // Replace the paths in the HTML content
  content = content.replace('<!-- threeJsPath -->', threeJsPath);
  content = content.replace('<!-- OrbitJsPath -->', orbitControlsPath);

  return content;
}


// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate
}
