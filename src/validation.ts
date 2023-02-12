import * as https from 'https';
import * as vscode from 'vscode';
import axios, { AxiosError, AxiosResponse } from 'axios';
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

	ValidationStatusBarItem.validationItem.updateContent('Loading', '$(sync~spin)');
	//Current diagnostics are cleared, everything is reseted.
	clearDiagnosticsListAndUpdateWindow(false);

	const fileLanguageID = document.languageId;

	//All the file content as raw text, this will be send as the request body
	const filecontent = document.getText();

	const showPopup = vscode.workspace.getConfiguration('webvalidator').showPopup;

	if (!showPopup) { // Validate silently
		postToW3C(filecontent, fileLanguageID)
			.then(response => handleW3CResponse(response, document, fileLanguageID, showPopup));
		return;
	}

	vscode.window.withProgress({ // Validate with progression popup
		location: vscode.ProgressLocation.Notification,
		title: 'W3C validation ...',
		cancellable: false,
	}, (progress, token) => {

		token.onCancellationRequested(() => {
			console.log('User canceled the validation');
		});

		return postToW3C(filecontent, fileLanguageID);
	}).then(response => {
		handleW3CResponse(response, document, fileLanguageID, showPopup);
	});
};

const postToW3C = (filecontent: string, fileLanguageID: string): Promise<AxiosResponse | null> => {
	return axios.post(W3C_API_URL, filecontent, {
		headers: { 'Content-type': `text/${fileLanguageID.toUpperCase()}; charset=utf-8` },
		httpsAgent: new https.Agent({ rejectUnauthorized: false })
	}).then(response => {
		return response;
	}).catch((error) => {
		console.error(error);
		if (error.code == 'ENOTFOUND') {
			vscode.window.showErrorMessage('W3C service not reachable, please check your internet connection.');
			return null;
		}
		if ((error as AxiosError).response?.status === 503) { // W3C down
			vscode.window.showErrorMessage('W3C service currently unavailable. Please retry later...');
			return null;
		}
		vscode.window.showErrorMessage('An error occured.');
		return null;
	});
};

const handleW3CResponse = (response: AxiosResponse | null, document: vscode.TextDocument, fileLanguageID: string, showPopup: boolean) => {
	if (response == null) {
		ValidationStatusBarItem.validationItem.updateContent();
		return;
	}
	if (response.data == null) {
		vscode.window.showErrorMessage('Error : incorrect response from W3C...');
		return;
	}
	const validationHasIssues = response.data.messages.length > 0;
	if (validationHasIssues) {
		createIssueDiagnosticsList(response.data.messages as IMessage[], document, showPopup);
		ValidationStatusBarItem.clearValidationItem.updateVisibility(true);
	} else {
		showPopup && vscode.window.showInformationMessage(`This ${fileLanguageID.toUpperCase()} file is valid !`);
	}
	if (showPopup || validationHasIssues) {
		ValidationStatusBarItem.validationItem.updateContent();
	} else {
		ValidationStatusBarItem.validationItem.updateContent('File is valid');
		setTimeout(() => ValidationStatusBarItem.validationItem.updateContent(), 2000);
	}
};

/**
 * This method create a new list referenced with the global array issueDiagnosticList from
 * the response of the post request to the W3C API
 * @param requestMessages the response from the W3C API
 * @param document the actual document
 * @param showPopup show the popup in lower right corner
 */
const createIssueDiagnosticsList = (requestMessages: IMessage[], document: vscode.TextDocument, showPopup = true) => {
	//The list (global variable issueDiagnosticList) is cleared before all.
	//The goal here is to create or recreate the content of the list.
	clearDiagnosticsListAndUpdateWindow(false);

	let errorCount = 0;
	let warningCount = 0;
	let infoCount = 0;

	//For each request response, we create a new instance of the IssueDiagnostic class
	//We also count the warning and error count, ot will then be displayed.
	requestMessages.forEach(element => {
		if (element.type === 'error')
			errorCount++;
		else if (element.type === 'info')
			infoCount++;
		else{
			warningCount++;
		}
		new IssueDiagnostic(element, document);
	});

	//We now refresh the diagnostics on the current text editor with
	//the list that is now refilled correctly with the informations of the request
	IssueDiagnostic.refreshWindowDiagnostics().then(allCleared => {
		ValidationStatusBarItem.clearValidationItem.updateVisibility(!allCleared);
	});

	if (showPopup) {
		const infoMessage = vscode.workspace.getConfiguration('webvalidator').showInfo ? `, ${infoCount} infos)` : '';
		const warningMessage = vscode.workspace.getConfiguration('webvalidator').showWarning ? `, ${warningCount} warnings` : '';
		vscode.window.showErrorMessage(
			`This ${document.languageId.toUpperCase()} document is not valid. (${errorCount} errors${warningMessage}${infoMessage}`,
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

/**
 * Called everytime a file is saved in vscode
 * @param context extension context
 */
export const startValidatationOnSaveHandler = (): void => {
	if (!activeFileIsValid(vscode.window.activeTextEditor?.document, false))
		return;
	if (vscode.workspace.getConfiguration('webvalidator').validateOnSave == false)
		return;
	startValidation(false);
};
