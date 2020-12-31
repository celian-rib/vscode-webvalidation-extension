// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const axios = require('axios').default;

const diagnosticsCollection = vscode.languages.createDiagnosticCollection('webcollection');

let issueDiagnostics = [];

/**
 * This method is called when your extension is activated
 * The extension is activated the very first time the command is executed
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	createStatusBarItem();

	let clearCmd = vscode.commands.registerCommand('webvalidator.clearvalidation', function () {
		clearDiagnostics();
	});

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(() => {
			refreshDiagnostic();
		})
	);


	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let validationCmd = vscode.commands.registerCommand('webvalidator.startvalidation', function () {
		// This code will be executed every time the command is executed

		if(!vscode.window.activeTextEditor){
			vscode.window.showWarningMessage('Open an HTML file first.');
			return;
		}
		if(vscode.window.activeTextEditor.document.languageId == "css"){
			vscode.window.showWarningMessage('CSS files are not supported yet.');
			return;
		}
		if(vscode.window.activeTextEditor.document.languageId != "html"){
			vscode.window.showWarningMessage('Not an HTML file.');
			return;
		}

		diagnosticsCollection.clear();

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
					createIssueDiagnostics(response.data.messages);
				else
					vscode.window.showInformationMessage('This HTML document is valid.');
			} else {
				vscode.window.showErrorMessage('200, No data.');
			}
		})
		.catch(function (error) {
			console.error(error);
			vscode.window.showErrorMessage('An error occured.');
		});

	});

	context.subscriptions.push(clearCmd);
	context.subscriptions.push(validationCmd);

	console.log("Extension activated");
}

// @ts-ignore
exports.activate = activate;

class IssueDiagnostic {
	constructor (diagnostic,lineRange, lineIntialContent) {
		this.diagnostic = diagnostic;
		this.lineRange = lineRange;
		this.lineIntialContent = lineIntialContent;
	}
}

function refreshDiagnostic(){
	try {
		diagnosticsCollection.clear();
		const diagnostics = [];
	
		issueDiagnostics.forEach(element => {
			const currentLineContent = vscode.window.activeTextEditor.document.getText(element.lineRange);
			if(element.lineIntialContent !== currentLineContent){
				issueDiagnostics.splice(issueDiagnostics.indexOf(element),1);
				console.log("1 issue auto cleared")
			}else{
				diagnostics.push(element.diagnostic);
			}
		});
	
		//Adding all diagnostics to page
		diagnosticsCollection.set(
			vscode.window.activeTextEditor.document.uri,
			diagnostics
		);
	}
	catch (e) {
		console.error(e);
	}
}

function clearDiagnostics(onlyWarning=false,verbose=true) {
	if(onlyWarning){
		issueDiagnostics.forEach(element => {
			if(element.diagnostic.severity == vscode.DiagnosticSeverity.Warning){
				issueDiagnostics.splice(issueDiagnostics.indexOf(element),1);
				if(verbose)	vscode.window.showWarningMessage('Warnings cleared.');
			}
		})
		refreshDiagnostic();
		console.log("Warn cleared");
	}else{
		issueDiagnostics = [];
		diagnosticsCollection.clear();
		if(verbose)	vscode.window.showWarningMessage('All errors and warnings cleared.');
		console.log("All cleared");
	}

}

/**
 * 
 * @param messages retrived messages from the W3C request 
 */
function createIssueDiagnostics(messages){
	clearDiagnostics(false,false);
	let errorCount = 0;
	let warningCount = 0;

	messages.forEach(element => {
		if(element.type === 'error')
			errorCount++;
		else 
			warningCount++;

		issueDiagnostics.push(getIssueDiagnostic(element));
	});
	
	refreshDiagnostic();
	
	vscode.window.showErrorMessage(
		`This HTML document is not valid. (${errorCount} errors , ${warningCount} warnings)`,'Clear all','Clear warnings'
	)
	.then(selection => {
		if(selection == 'Clear all')
			clearDiagnostics();
		else if(selection == 'Clear warnings')
			clearDiagnostics(true);
	});
}

function getIssueDiagnostic(data) {
	return new IssueDiagnostic(
		getDiagnostic(data),
		getLineRange(data),
		vscode.window.activeTextEditor.document.getText(getLineRange(data))
	);
}

function getLineRange(data) {
	return vscode.window.activeTextEditor.document.lineAt(data.lastLine-1).range;
}

function getRange(data) {
	let startPosition = new vscode.Position(data.lastLine - 1,data.hiliteStart - 1);
	let stopPosition = new vscode.Position(data.lastLine -1 ,data.hiliteStart - 1 + data.hiliteLength);
	return new vscode.Range(startPosition,stopPosition);
}

/**
 * Create a diagnostic to be shown from one message collected by the W3C request
 * @param  data on message of the request
 * @return diagnostic object
 */
function getDiagnostic(data) {
	let severity = vscode.DiagnosticSeverity.Information;
	switch (data.type) {
		case 'error':
			severity = vscode.DiagnosticSeverity.Error
			break;
		case 'info':
			severity = vscode.DiagnosticSeverity.Warning
			break;
	}

	const diagnostic = new vscode.Diagnostic(
		getRange(data), 
		data.message,
		severity
	);
	diagnostic.code = 'web_validator';
	diagnostic.source = data.type;

	return diagnostic;
}


/**
 * This method is called when the extension is activated (from activate())
 * It create a statusBarItem in vscode window
 */
function createStatusBarItem() {
	let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,0);
	
	statusBarItem.command = 'webvalidator.startvalidation';
	statusBarItem.text = `$(rocket) Web Validator`;
	statusBarItem.tooltip = 'Check if this HTML document is up to standard with the W3C Validator API';
	statusBarItem.show();

	console.log("Status bar item created");
	return statusBarItem;
}

// this method is called when your extension is deactivated
function deactivate() {	console.log("Extension deactivated"); }

module.exports = {
	// @ts-ignore
	activate,
	deactivate
}
