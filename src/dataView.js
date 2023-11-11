const vscode = require('vscode');

function activate(context) {
    let disposable = vscode.commands.registerCommand('jbeam-editor.showData', function () {
        const panel = vscode.window.createWebviewPanel(
            'showMarkdown', // Identifies the type of the webview. Used internally
            'Display Markdown', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {} // Webview options.
        );

        panel.webview.html = 'Hello world!';
    });

    context.subscriptions.push(disposable);}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}