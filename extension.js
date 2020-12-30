// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const axios = require('axios').default;


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('webvalidator.startvalidation', function () {
		// This code will be executed every time the command is executed

		if(!vscode.window.activeTextEditor){
			vscode.window.showInformationMessage('Open an HTML file first');
			return;
		}
		if(vscode.window.activeTextEditor.document.languageId != "html"){
			vscode.window.showInformationMessage('Not an HTML file.');
			return;
		}

		vscode.window.showInformationMessage('W3C Validation starting on this HTML file !');

		const filecontent = vscode.window.activeTextEditor.document.getText();

		const headers = {
			'Content-type': 'text/html; charset=utf-8',
		}
	
		axios.post('https://validator.w3.org/nu/?out=json', filecontent, {
			headers: headers,
		})
		.then(function (response) {
			if (response.data) {
				if (response.data.messages.length > 0){
					vscode.window.showErrorMessage('Errors found');
					const errors = response.data.messages;
					// errors.forEach(error => {
						
					// });
					vscode.window.showErrorMessage("l" + errors[0].lastLine + " " + errors[0].message); 
					// vscode.window.showInformationMessage(response.data.messages[0].subType + " : " + response.data.messages[0].type);
				} else {
					vscode.window.showInformationMessage('No errors found');
				}
			} else {
				vscode.window.showErrorMessage('200, No data');
			}
		})
		.catch(function (error) {
			console.log(error);
			vscode.window.showErrorMessage('An error occured.');
		});

	});

	context.subscriptions.push(disposable);
}

// @ts-ignore
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	// @ts-ignore
	activate,
	deactivate
}
