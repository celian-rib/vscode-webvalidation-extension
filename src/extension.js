// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const axios = require('axios').default;

const diagnosticsCollection = vscode.languages.createDiagnosticCollection('webcollection');
let issueDiagnosticsList = [];

let statusBarItem;

/**
 * This is the main method of the extension, it make a request to the W3C API and
 * analyse the response.
 */
function startValidation() {

	//Check if file is valid 
	//Only suport HTML files for the moment
	if (!activeFileIsValid())
		return;

	//Current diagnostics are cleared, everything is reseted.
	clearDiagnosticsListAndUpdateWindow();

	vscode.window.showInformationMessage('Validation starting on this HTML file...');

	//All the file content as raw text, this will be send as the request body
	const filecontent = vscode.window.activeTextEditor.document.getText();

	//Request header
	const headers = { 'Content-type': 'text/html; charset=utf-8' }

	createStatusBarItem("$(rocket) Loading ...");

	//Starting axios request on the W3C API, post request with raw file content
	axios.post('https://validator.w3.org/nu/?out=json', filecontent, {
		headers: headers,
	})
		.then(function (response) {
			if (response.data) {//Check if response is not empty
				if (response.data.messages.length > 0)//Check if reponse contain "HTML errors" found by W3C Validator
					createIssueDiagnosticsList(response.data.messages);
				else
					vscode.window.showInformationMessage('This HTML document is valid.');
			} else {
				vscode.window.showErrorMessage('200, No data.');
			}
		})
		.catch(function (error) {
			console.error(error);
			vscode.window.showErrorMessage('An error occured. (Check your internet connection');
		});

	createStatusBarItem();
}

/**
 * @return true if the active text editor is a compatible file with the validation.
 */
function activeFileIsValid() {
	if (!vscode.window.activeTextEditor) {
		vscode.window.showWarningMessage('Open an HTML file first.');
		return false;
	}
	if (vscode.window.activeTextEditor.document.languageId == "css") {
		vscode.window.showWarningMessage('CSS files are not supported yet.');
		return false;
	}
	if (vscode.window.activeTextEditor.document.languageId != "html") {
		vscode.window.showWarningMessage('Not an HTML file.');
		return false;
	}
	return true;
}

/**
 * Class that contain a vscode.diagnostic and its correponding line's range with the 
 * original content of this same line
 * - The line content is used for the auto clear feature, as it is compared with the actual content of this same line
 * @constructor Create an instance with one issue that come from the request of the API
 */
class IssueDiagnostic {
	constructor(data) {
		this.diagnostic = getDiagnostic(data);
		this.lineRange = getLineRange(data);
		this.lineIntialContent = vscode.window.activeTextEditor.document.getText(getLineRange(data));
	}
}

/**
 * This method create a new list referenced with the global arry issueDiagnosticList from 
 * the response of the post request to the W3C API
 * @param requestReponse the response from the W3C API
 */
function createIssueDiagnosticsList(requestReponse) {
	//The list (global variable issueDiagnosticList) is cleared before all.
	//The goal here is to create or recreate the content of the list.
	clearDiagnosticsListAndUpdateWindow(false, false);

	let errorCount = 0;
	let warningCount = 0;

	//For each request response, we create a new instance of the IssueDiagnostic class
	//We also count the warning and error count, ot will then be displayed.
	requestReponse.forEach(element => {
		if (element.type === 'error')
			errorCount++;
		else
			warningCount++;

		issueDiagnosticsList.push(new IssueDiagnostic(element));
	});

	//We now refresh the diagnostics on the current text editor with
	//the list that is now refilled correctly with the informations of the request
	refreshWindowDiagnostics();

	vscode.window.showErrorMessage(
		`This HTML document is not valid. (${errorCount} errors , ${warningCount} warnings)`, 'Clear all', 'Clear warnings'
	)
		.then(selection => {//Ask the user if diagnostics have to be cleared from window
			if (selection == 'Clear all')
				clearDiagnosticsListAndUpdateWindow();
			else if (selection == 'Clear warnings')
				clearDiagnosticsListAndUpdateWindow(true);
		});
}

/**
 * Refresh the diagnostics on the active text editor by reading the content of
 * the issueDiagnosticList array.
 * This is called on every changes in the active text editor.
 */
function refreshWindowDiagnostics() {
	try {
		//Clearing window's diagnostic
		diagnosticsCollection.clear();
		const diagnostics = [];

		//Auto clear diagnostic on page :
		//For each registered diagnostic in the issueDiagnostic list
		issueDiagnosticsList.forEach(element => {

			//We first check if the line of this diagnostic has changed
			//So we compare the initial content of the diagnostic's line with the actual content.
			const currentLineContent = vscode.window.activeTextEditor.document.getText(element.lineRange);
			if (element.lineIntialContent !== currentLineContent) {
				issueDiagnosticsList.splice(issueDiagnosticsList.indexOf(element), 1);
				console.log("1 issue auto cleared")
			} else {
				//In case the line has no changes, that means we should keep this diagnostic on page.
				diagnostics.push(element.diagnostic);
			}
		});

		//Adding all remaining diagnostics to page.
		diagnosticsCollection.set(
			vscode.window.activeTextEditor.document.uri,
			diagnostics
		);
	}
	catch (e) {
		console.error(e);
	}
}

/**
 * This method clear all diagnostic on window and in the issueDiagnosticList array
 * @param onlyWarning set to true if only warnings should be cleared
 * @param verbose set to false if no message should be displayed in the editor
 */
const clearDiagnosticsListAndUpdateWindow = (onlyWarning = false, verbose = true) => {
	if (onlyWarning) {
		issueDiagnosticsList.forEach(element => {
			if (element.diagnostic.severity == vscode.DiagnosticSeverity.Warning) {
				issueDiagnosticsList.splice(issueDiagnosticsList.indexOf(element), 1);
				if (verbose) vscode.window.showWarningMessage('Warnings cleared.');
			}
		})
		refreshWindowDiagnostics();
		console.log("Warn cleared");
	} else {
		issueDiagnosticsList = [];
		diagnosticsCollection.clear();
		if (verbose) vscode.window.showWarningMessage('All errors and warnings cleared.');
		console.log("All cleared");
	}

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
 * @param data One error message from the request
 * @return the corresponding Range of the whole line of the given message from the request (data)
 */
function getLineRange(data) {
	return vscode.window.activeTextEditor.document.lineAt(data.lastLine - 1).range;
}

/**
 * @param data One error message from the request
 * @return the corresponding Range of the given message from the request (data)
 */
function getRange(data) {
	let startPosition = new vscode.Position(data.lastLine - 1, data.hiliteStart - 1);
	let stopPosition = new vscode.Position(data.lastLine - 1, data.hiliteStart - 1 + data.hiliteLength);
	return new vscode.Range(startPosition, stopPosition);
}


/**
 * This method is called when the extension is activated (from activate())
 * It create a statusBarItem in vscode bottom bar
 */
function createStatusBarItem(customText = null) {
	if (statusBarItem == null)
		statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	statusBarItem.command = 'webvalidator.startvalidation';
	statusBarItem.text = customText == null ? `$(rocket) Web Validator` : customText;
	statusBarItem.tooltip = 'Check if this HTML document is up to standard with the W3C Validator API';
	statusBarItem.show();
	console.log("Status bar item created");
}

/**
 * This method is called when the extension is activated
 * The extension is activated on launch or on the very 
 * first time the command is executed
 * The main goal of this method is to register all available commands such
 * as "start validation" or "clear diagnostic"
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	//Creating the button in status bar on launch
	createStatusBarItem();

	// The commands are defined in the package.json file

	//Clear command
	context.subscriptions.push(
		vscode.commands.registerCommand('webvalidator.clearvalidation', function () {
			clearDiagnosticsListAndUpdateWindow();
		})
	);

	//Clear command
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(() => {
			refreshWindowDiagnostics();
		})
	);

	//Start validation command
	context.subscriptions.push(
		vscode.commands.registerCommand('webvalidator.startvalidation', function () {
			startValidation();
		})
	);

	console.log("Web validator extension activated !");

}

// @ts-ignore
exports.activate = activate;

/**
 * Method called when the extension id deactivated
 */
function deactivate() { console.log("Web validator extension disabled"); }

module.exports = {
	// @ts-ignore
	activate,
	deactivate
}
