import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';
import { activeFileIsValid } from './utils';
import { IMessage } from './extension';
import IssueDiagnostic from './IssueDiagnostic';
import ValidationStatusBarItem from './ValidationStatusBarItem';

const W3C_API_URL = 'https://validator.w3.org/nu/?out=json';

/**
 * This is the main method of the extension, it make a request to the W3C API and
 * analyse the response.
 */
export const startValidation = (activeFileNotValidWarning = true): void => {

	const document = vscode.window.activeTextEditor?.document;
	//Check if file is valid
	//Only suport HTML and CSS files for the moment
	if (!activeFileIsValid(document, activeFileNotValidWarning)) return;

	if (!document) return;

	//Current diagnostics are cleared, everything is reseted.
	clearDiagnosticsListAndUpdateWindow(false);

	const fileLanguageID = document.languageId;

	//All the file content as raw text, this will be send as the request body
	const filecontent = document.getText();

	const showPopup = vscode.workspace.getConfiguration('webvalidator').showPopup;

	if(showPopup){
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'W3C validation ...',
			cancellable: false,
		}, (progress, token) => {
			ValidationStatusBarItem.validationItem.updateContent('Loading', '$(sync~spin)');

			token.onCancellationRequested(() => {
				console.log('User canceled the validation');
			});

			return postToW3C(filecontent, fileLanguageID);
		}).then(response => {
			handleW3CResponse(response, document, fileLanguageID, showPopup);
		});
	}else{
		postToW3C(filecontent, fileLanguageID).then(response => handleW3CResponse(response, document,fileLanguageID, showPopup));
	}
};

const postToW3C = (filecontent:string, fileLanguageID:string) : Promise<AxiosResponse | null> => {
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
};

const handleW3CResponse = (response: AxiosResponse|null, document: vscode.TextDocument, fileLanguageID: string , showPopup: boolean) => {
	if (response) {
		if (response.data) {//Check if response is not empty
			if (response.data.messages.length > 0) {//Check if reponse contain errors and warnings found by W3C Validator
				createIssueDiagnosticsList(response.data.messages as IMessage[], document, showPopup);
				ValidationStatusBarItem.clearValidationItem.updateVisibility(true);
			} else {
				showPopup &&  vscode.window.showInformationMessage(`This ${fileLanguageID.toUpperCase()} file is valid !`);
			}
		} else {
			vscode.window.showErrorMessage('200, No data.');
		}
	}
};

export const startValidatationOnSaveHandler = (context: vscode.ExtensionContext): void => {
	if(context.globalState.get('first_time_save') != true) {
		vscode.window.showInformationMessage('Files will be checked with W3C on save. You can disable this in the extension settings');
		context.globalState.update('first_time_save', true);
	}
	if (vscode.workspace.getConfiguration('webvalidator').validateOnSave)
		startValidation(false);
};

/**
 * This method create a new list referenced with the global array issueDiagnosticList from
 * the response of the post request to the W3C API
 * @param requestMessages the response from the W3C API
 * @param document the actual document
 * @param showPopup show the popup in lower right corner
 */
const createIssueDiagnosticsList = (requestMessages: IMessage[], document: vscode.TextDocument, showPopup=true) => {
	//The list (global variable issueDiagnosticList) is cleared before all.
	//The goal here is to create or recreate the content of the list.
	clearDiagnosticsListAndUpdateWindow(false);

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

	if(showPopup){
		vscode.window.showErrorMessage(
			`This ${document.languageId.toUpperCase()} document is not valid. (${errorCount} errors , ${warningCount} warnings)`,
			...(warningCount > 0 ? ['Clear all', 'Clear warnings'] : ['Clear all'])
		).then(selection => {//Ask the user if diagnostics have to be cleared from window
			if (selection === 'Clear all') { clearDiagnosticsListAndUpdateWindow(); }
			else if (selection === 'Clear warnings') { clearDiagnosticsListAndUpdateWindow(true); }
		});
	}
};

/**
 * This method clear all diagnostic on window and in the issueDiagnosticList array
 * @param onlyWarning set to true if only warnings should be cleared
 * @param editorMessages set to false if no message should be displayed in the editor
 */
export const clearDiagnosticsListAndUpdateWindow = (onlyWarning = false): void => {
	if (onlyWarning) {
		IssueDiagnostic.clearVSCodeErrorsDiagnostics();
		IssueDiagnostic.refreshWindowDiagnostics().then(allCleared => {
			ValidationStatusBarItem.clearValidationItem.updateVisibility(!allCleared);
		});
	} else {
		IssueDiagnostic.clearAllVSCodeDiagnostics();
		ValidationStatusBarItem.clearValidationItem.updateVisibility(false);
	}
};
