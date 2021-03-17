import * as vscode from 'vscode';
import axios from 'axios';
import { activeFileIsValid } from './utils';
import { IMessage } from './extension';
import IssueDiagnostic from './IssueDiagnostic';
import ValidationStatusBarItem from './StatusBarItem';

const W3C_API_URL = 'https://validator.w3.org/nu/?out=json';

/**
 * This is the main method of the extension, it make a request to the W3C API and
 * analyse the response.
 */
export const startValidation = (): void => {

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

	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: 'W3C validation ...',
		cancellable: false,
	}, (progress, token) => {
		ValidationStatusBarItem.validationItem.updateContent('Loading', '$(sync~spin)');

		token.onCancellationRequested(() => {
			console.log('User canceled the validation');
		});

		return axios.post(W3C_API_URL, filecontent, {
			headers: { 'Content-type': `text/${fileLanguageID.toUpperCase()}; charset=utf-8` },
		}).then(response => {
			return response;
		}).catch((error) => {
			console.error(error);
			vscode.window.showErrorMessage('An error occured.');
			return null;
		}).finally(() => {
			ValidationStatusBarItem.validationItem.updateContent();
		});
	}).then(response => {
		if (response) {
			if (response.data) {//Check if response is not empty
				if (response.data.messages.length > 0) {//Check if reponse contain errors and warnings found by W3C Validator
					createIssueDiagnosticsList(response.data.messages as IMessage[], document);
					ValidationStatusBarItem.clearValidationItem.updateVisibility(true);
				} else {
					vscode.window.showInformationMessage(`This ${fileLanguageID.toUpperCase()} file is valid !`);
				}
			} else {
				vscode.window.showErrorMessage('200, No data.');
			}
		}
	});
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

		new IssueDiagnostic(element, document);
	});

	//We now refresh the diagnostics on the current text editor with
	//the list that is now refilled correctly with the informations of the request
	IssueDiagnostic.refreshWindowDiagnostics().then(allCleared => {
		ValidationStatusBarItem.clearValidationItem.updateVisibility(!allCleared);
	});

	vscode.window.showErrorMessage(
		`This ${document.languageId.toUpperCase()} document is not valid. (${errorCount} errors , ${warningCount} warnings)`,
		...(warningCount > 0 ? ['Clear all', 'Clear warnings'] : ['Clear all'])
	).then(selection => {//Ask the user if diagnostics have to be cleared from window
		if (selection === 'Clear all') { clearDiagnosticsListAndUpdateWindow(); }
		else if (selection === 'Clear warnings') { clearDiagnosticsListAndUpdateWindow(true); }
	});
};

/**
 * This method clear all diagnostic on window and in the issueDiagnosticList array
 * @param onlyWarning set to true if only warnings should be cleared
 * @param editorMessages set to false if no message should be displayed in the editor
 */
export const clearDiagnosticsListAndUpdateWindow = (onlyWarning = false, editorMessages = true): void => {
	if (onlyWarning) {
		IssueDiagnostic.clearErrorsDiagnostics();
		if (editorMessages) vscode.window.showWarningMessage('Warnings cleared.');
		IssueDiagnostic.refreshWindowDiagnostics().then(allCleared => {
			ValidationStatusBarItem.clearValidationItem.updateVisibility(!allCleared);
		});
	} else {
		IssueDiagnostic.clearAllDiagnostics();
		if (editorMessages) vscode.window.showWarningMessage('All errors and warnings cleared.');
		ValidationStatusBarItem.clearValidationItem.updateVisibility(false);
	}
};
