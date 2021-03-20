import * as vscode from 'vscode';
import { IMessage } from './extension';

/**
 * Check if a file is valid for the validity (HTML or CSS), if not this methd handle
 * the warning messages in the editor
 * @param document The document to check
 * @return true if the active text editor is a compatible file with the validation.
 */
export const activeFileIsValid = (document: vscode.TextDocument | undefined, editorWarning = true): boolean => {
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
 * @param message The message from which the range will be created
 * @return the corresponding Range of the given message
 */
export const getMessageRange = (message: IMessage): vscode.Range => {
	const startPosition = new vscode.Position(message.lastLine - 1, message.hiliteStart - 1);
	const stopPosition = new vscode.Position(message.lastLine - 1, message.hiliteStart - 1 + message.hiliteLength);
	return new vscode.Range(startPosition, stopPosition);
};

/**
 * @param line the line of the document to check
 * @param document, the document to check
 * @return the corresponding Range of the whole line of the given message from the request
 */
export const getLineRange = (line: number, document: vscode.TextDocument): vscode.Range | undefined => {
	if (document.lineCount > line)
		return document.lineAt(line - 1).range;
	else
		return undefined;
};
