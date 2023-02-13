import * as vscode from 'vscode';
import { activeFileIsValid } from './utils';
import { ValidationFile } from './ValidationFile';

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

	new ValidationFile(document).startValidation();
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
