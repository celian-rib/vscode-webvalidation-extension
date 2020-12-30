// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const axios = require('axios').default;


/**
 * This method is called when your extension is activated
 * The extension is activated the very first time the command is executed
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	createStatusBarItem(context);

	const collection = vscode.languages.createDiagnosticCollection('webcollection');
	
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('webvalidator.startvalidation', function () {
		// This code will be executed every time the command is executed

		if(!vscode.window.activeTextEditor){
			vscode.window.showWarningMessage('Open an HTML file first');
			return;
		}
		if(vscode.window.activeTextEditor.document.languageId != "html"){
			vscode.window.showWarningMessage('Not an HTML file.');
			return;
		}

		collection.clear();

		vscode.window.showInformationMessage('Validation starting on this HTML file...');

		const filecontent = vscode.window.activeTextEditor.document.getText();

		//Request header
		const headers = {
			'Content-type': 'text/html; charset=utf-8',
		}
		
		//Starting axios request
		axios.post('https://validator.w3.org/nu/?out=json', filecontent, {
			headers: headers,
		})
		.then(function (response) {
			if (response.data) {//Check if response is not empty
				if (response.data.messages.length > 0)//Check if reponse contain "HTML errors" found by W3C Validator
					handleW3CErrors(collection, response.data.messages);
				else
					vscode.window.showInformationMessage('This HTML document is valid.');
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

	console.log("Extension activated");
}

// @ts-ignore
exports.activate = activate;

/**
 * 
 * @param collection diagnostics collection 
 * @param messages retrived messages from the W3C request 
 */
function handleW3CErrors(collection,messages){
	//Asking if user want to see the erros in code
	vscode.window.showErrorMessage(`This HTML document is not valid. (${messages.length} errors)`, 'Show errors')
	.then(selection => {
		if(selection == 'Show errors'){

			const diagnostics = [];
			//Create a diagnostic for each message
			messages.forEach(element => {
				diagnostics.push(getDiagnostic(element));
			});

			//Adding all diagnostics to page
			collection.set(
				vscode.window.activeTextEditor.document.uri,
				diagnostics
			);

			//Ask to clear diagnostic
			vscode.window.showInformationMessage(`${messages.length} errors are displayed`, 'Clear')
			.then(selection => {
				if(selection == 'Clear'){
					collection.clear();
				}
			});
		}
	});
}

/**
 * Create a diagnostic to be shown from one message collected by the W3C request
 * @param  data on message of the request
 * @return diagnostic object
 */
function getDiagnostic(data) {
	console.log(data);
	
	let startPosition = new vscode.Position(data.lastLine - 1,data.hiliteStart - 1);
	let stopPosition = new vscode.Position(data.lastLine -1 ,data.hiliteStart - 1 + data.hiliteLength);
	let range = new vscode.Range(startPosition,stopPosition);

	const diagnostic = new vscode.Diagnostic(
		range, 
		data.message,
		vscode.DiagnosticSeverity.Error
	);
	diagnostic.code = 'web_validation';
	return diagnostic;
}


/**
 * This method is called when the extension is activated (from activate())
 * It create a statusBarItem in vscode window
 * @param {vscode.ExtensionContext} context
 */
function createStatusBarItem(context) {
	let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,0);
	
	statusBarItem.command = 'webvalidator.startvalidation';
	statusBarItem.text = `$(rocket) Web Validator`;
	statusBarItem.tooltip = 'Check if this HTML document is up to standard with the W3C Validator API';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	console.log("Status bar item created");
}

// this method is called when your extension is deactivated
function deactivate() {	console.log("Extension deactivated"); }

module.exports = {
	// @ts-ignore
	activate,
	deactivate
}
