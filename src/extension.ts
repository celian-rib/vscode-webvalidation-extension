// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import axios from 'axios';

const DIAGNOTIC_COLLECTION = vscode.languages.createDiagnosticCollection('webcollection');
let ISSUE_DIAGNOSTIC_LIST: IssueDiagnostic[] = [];

let STATUS_BAR_ITEM: vscode.StatusBarItem;
let STATUS_BAR_ITEM_CLEAR_BTN: vscode.StatusBarItem;

const W3C_API_URL = 'https://validator.w3.org/nu/?out=json';

export interface IMessage {
	extract: string,
	firstColumn: number,
	hiliteLength: number,
	hiliteStart: number,
	lastColumn: number,
	lastLine: number,
	message: string,
	type: string
}

/**
 * Class that contain a vscode.diagnostic and its correponding line's range with the 
 * original content of this same line
 * - The line content is used for the auto clear feature, as it is compared with the actual content of this same line
 * @constructor Create an instance with one issue that come from the request of the API
 */
export class IssueDiagnostic {
	diagnostic: vscode.Diagnostic;
	lineRange: vscode.Range | undefined;
	lineIntialContent: string | undefined;
	constructor(data: IMessage, document: vscode.TextDocument) {
		const lr = getLineRange(data.lastLine, document);
		this.diagnostic = getDiagnostic(data);
		this.lineRange = lr;
		this.lineIntialContent = document.getText(lr);
	}
}

/**
 * This is the main method of the extension, it make a request to the W3C API and
 * analyse the response.
 */
const startValidation = () => {

	const document = vscode.window.activeTextEditor?.document;
	//Check if file is valid 
	//Only suport HTML and CSS files for the moment
	if (!activeFileIsValid(document)) return;

	if (!document) return;

	//Current diagnostics are cleared, everything is reseted.
	clearDiagnosticsListAndUpdateWindow(false, false);

	const fileLanguageID = document.languageId;

	//All the file content as raw text, this will be send as the request body
	const filecontent = document.getText();
	vscode.window.showInformationMessage(
		`Validation starting on this ${fileLanguageID.toUpperCase()} file...`
	);

	updateStatusBarItem('$(sync~spin) Loading ...');

	//Request header
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const headers = { 'Content-type': `text/${fileLanguageID.toUpperCase()}; charset=utf-8` };

	//Starting axios request on the W3C API, post request with raw file content
	axios.post(W3C_API_URL, filecontent, {
		headers: headers,
	})
		.then((response) => {
			if (response.data) {//Check if response is not empty
				if (response.data.messages.length > 0) {//Check if reponse contain errors and warnings found by W3C Validator
					createIssueDiagnosticsList(response.data.messages, document);
					updateStatusBarItemClearButton();
				} else {
					vscode.window.showInformationMessage(`This ${fileLanguageID.toUpperCase()} file is valid !`);
				}
			} else {
				vscode.window.showErrorMessage('200, No data.');
			}
		})
		.catch((error) => {
			console.error(error);
			vscode.window.showErrorMessage('An error occured.');
		})
		.finally(() => {
			updateStatusBarItem();
		});
};

/**
 * Check if a file is valid for the validity (HTML or CSS), if not this methd handle
 * the warning messages in the editor
 * @param document The document to check
 * @return true if the active text editor is a compatible file with the validation.
 */
const activeFileIsValid = (document: vscode.TextDocument | undefined, editorWarning = true): boolean => {
	if (!document) {
		if (editorWarning) vscode.window.showWarningMessage('Open a supported file first. (CSS/HTML)');
		return false;
	}
	const languageID = document.languageId.toUpperCase();
	if (languageID !== 'HTML' && languageID !== 'CSS') {
		if (editorWarning) vscode.window.showWarningMessage('Not an HTML or CSS file.');
		return false;
	}
	return true;
};

/**
 * This method create a new list referenced with the global array issueDiagnosticList from 
 * the response of the post request to the W3C API
 * @param requestMessages the response from the W3C API
 * @param document the actual document
 */
const createIssueDiagnosticsList = (requestMessages: IMessage[], document: vscode.TextDocument) => {
	//The list (global variable issueDiagnosticList) is cleared before all.
	//The goal here is to create or recreate the content of the list.
	clearDiagnosticsListAndUpdateWindow(false, false);

	let errorCount = 0;
	let warningCount = 0;

	//For each request response, we create a new instance of the IssueDiagnostic class
	//We also count the warning and error count, ot will then be displayed.
	requestMessages.forEach(element => {
		if (element.type === 'error')
			errorCount++;
		else
			warningCount++;

		ISSUE_DIAGNOSTIC_LIST.push(new IssueDiagnostic(element, document));
	});

	//We now refresh the diagnostics on the current text editor with
	//the list that is now refilled correctly with the informations of the request
	refreshWindowDiagnostics();

	vscode.window.showErrorMessage(
		`This ${document.languageId.toUpperCase()} document is not valid. (${errorCount} errors , ${warningCount} warnings)`,
		...(warningCount > 0 ? ['Clear all', 'Clear warnings'] : ['Clear all'])
	).then(selection => {//Ask the user if diagnostics have to be cleared from window
		if (selection === 'Clear all') { clearDiagnosticsListAndUpdateWindow(); }
		else if (selection === 'Clear warnings') { clearDiagnosticsListAndUpdateWindow(true); }
	});
};

/**
 * Refresh the diagnostics on the active text editor by reading the content of
 * the issueDiagnosticList array.
 * This is called on every changes in the active text editor.
 */
const refreshWindowDiagnostics = () => {
	if (!vscode.window.activeTextEditor) { return; }

	try {
		//Clearing window's diagnostic
		DIAGNOTIC_COLLECTION.clear();
		const diagnostics: vscode.Diagnostic[] = [];

		//Auto clear diagnostic on page :
		//For each registered diagnostic in the issueDiagnostic list
		ISSUE_DIAGNOSTIC_LIST.forEach(element => {
			//We first check if the line of this diagnostic has changed
			//So we compare the initial content of the diagnostic's line with the actual content.
			const currentLineContent = vscode.window.activeTextEditor?.document.getText(element.lineRange);
			if (element.lineIntialContent !== currentLineContent) {
				ISSUE_DIAGNOSTIC_LIST.splice(ISSUE_DIAGNOSTIC_LIST.indexOf(element), 1);
				console.log('1 issue auto cleared');
			} else {
				//In case the line has no changes, that means we should keep this diagnostic on page.
				diagnostics.push(element.diagnostic);
			}
		});

		//Adding all remaining diagnostics to page.
		DIAGNOTIC_COLLECTION.set(
			vscode.window.activeTextEditor.document.uri,
			diagnostics
		);

		if (diagnostics.length === 0) { updateStatusBarItemClearButton(true); }
	}
	catch (e) {
		console.error(e);
	}
};

/**
 * This method clear all diagnostic on window and in the issueDiagnosticList array
 * @param onlyWarning set to true if only warnings should be cleared
 * @param editorMessages set to false if no message should be displayed in the editor
 */
const clearDiagnosticsListAndUpdateWindow = (onlyWarning = false, editorMessages = true) => {
	if (onlyWarning) {

		const tempArr = ISSUE_DIAGNOSTIC_LIST;
		ISSUE_DIAGNOSTIC_LIST = [];
		tempArr.forEach(element => {
			if (element.diagnostic.severity === vscode.DiagnosticSeverity.Error) { ISSUE_DIAGNOSTIC_LIST.push(element); }
		});

		if (editorMessages) { vscode.window.showWarningMessage('Warnings cleared.'); }

		console.log('Warn cleared');
		refreshWindowDiagnostics();
	} else {
		ISSUE_DIAGNOSTIC_LIST = [];
		DIAGNOTIC_COLLECTION.clear();
		if (editorMessages) { vscode.window.showWarningMessage('All errors and warnings cleared.'); }
		console.log('All cleared');
		updateStatusBarItemClearButton(true);
	}

};

/**
 * Create a diagnostic to be shown from one message collected by the W3C request
 * @param  message the message from which the diagnostic will be created
 * @return diagnostic object
 */
const getDiagnostic = (message: IMessage): vscode.Diagnostic => {
	let severity = vscode.DiagnosticSeverity.Information;
	switch (message.type) {
	case 'error':
		severity = vscode.DiagnosticSeverity.Error;
		break;
	case 'info':
		severity = vscode.DiagnosticSeverity.Warning;
		break;
	}

	const diagnostic = new vscode.Diagnostic(
		getRange(message),
		message.message,
		severity
	);
	diagnostic.code = 'web_validator';
	diagnostic.source = message.type;

	return diagnostic;
};

/**
 * @param line the line of the document to check
 * @param document, the document to check
 * @return the corresponding Range of the whole line of the given message from the request
 */
const getLineRange = (line: number, document: vscode.TextDocument): vscode.Range | undefined => {
	if (document.lineCount > line)
		return document.lineAt(line - 1).range;
	else
		return undefined;
};

/**
 * @param message The message from which the range will be created
 * @return the corresponding Range of the given message
 */
const getRange = (message: IMessage): vscode.Range => {
	const startPosition = new vscode.Position(message.lastLine - 1, message.hiliteStart - 1);
	const stopPosition = new vscode.Position(message.lastLine - 1, message.hiliteStart - 1 + message.hiliteLength);
	return new vscode.Range(startPosition, stopPosition);
};

/**
 * This method is called when the extension is activated (from activate())
 * It create a statusBarItem in vscode bottom bar
 * @param customText set a custom text in the status bar item
 */
const updateStatusBarItem = (customText?: string) => {
	if (!STATUS_BAR_ITEM) {
		console.log('Status bar item created');
		STATUS_BAR_ITEM = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	}
	STATUS_BAR_ITEM.command = 'webvalidator.startvalidation';
	const defaultText = '$(pass)' + (activeFileIsValid(vscode.window.activeTextEditor?.document, false) ? ' W3C validation' : '');
	STATUS_BAR_ITEM.text = customText === undefined ? defaultText : customText;
	STATUS_BAR_ITEM.tooltip = 'Start the W3C validation of this file';
	STATUS_BAR_ITEM.show();
	console.log('Status bar item updated');
};

/**
 * This method create or hide the clear button in status bar
 * @param hide true if the goal is to hide the clear button
 */
const updateStatusBarItemClearButton = (hide?: boolean) => {
	if (!STATUS_BAR_ITEM_CLEAR_BTN) {
		STATUS_BAR_ITEM_CLEAR_BTN = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
		console.log('Clear button created');
	}
	STATUS_BAR_ITEM_CLEAR_BTN.command = 'webvalidator.clearvalidation';
	STATUS_BAR_ITEM_CLEAR_BTN.text = '$(notifications-clear) Clear W3C validation';
	STATUS_BAR_ITEM_CLEAR_BTN.tooltip = 'This will clear all issues made by the W3C Web Validator extension';
	if (hide)
		STATUS_BAR_ITEM_CLEAR_BTN.hide();
	else
		STATUS_BAR_ITEM_CLEAR_BTN.show();

	console.log('Clear button updated');
};

/**
 * This method is called when the extension is activated
 * The extension is activated on launch or on the very 
 * first time the command is executed
 * The main goal of this method is to register all available commands such
 * as "start validation" or "clear diagnostic"
 * @param context
 */
const activate = (context: vscode.ExtensionContext) => {

	//Creating the button in status bar on launch
	updateStatusBarItem();

	// The commands are defined in the package.json file

	//Subscribe clear command
	context.subscriptions.push(
		vscode.commands.registerCommand('webvalidator.clearvalidation', () => {
			clearDiagnosticsListAndUpdateWindow();
		})
	);

	//Subscribe onDidChangeTextDocument
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(() => {
			refreshWindowDiagnostics();
		})
	);

	//Subscribe onDidChangeActiveTextEditor
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => {
			updateStatusBarItem();
		})
	);

	//Subscribe start validation command
	context.subscriptions.push(
		vscode.commands.registerCommand('webvalidator.startvalidation', () => {
			startValidation();
		})
	);

	console.log('Web validator extension activated !');
};

exports.activate = activate;

/**
 * Method called when the extension id deactivated
 */
const deactivate = () => { console.log('Web validator extension disabled'); };

module.exports = {
	activate,
	deactivate,
};
