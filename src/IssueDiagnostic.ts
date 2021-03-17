import * as vscode from 'vscode';
import { IMessage } from './extension';
import { getLineRange, getMessageRange } from './utils';

/**
 * Class that contain a vscode.diagnostic and its correponding line's range with the
 * original content of this same line
 * - The line content is used for the auto clear feature, as it is compared with the actual content of this same line
 * @constructor Create an instance with one issue that come from the request of the API
 */
export default class IssueDiagnostic {

	/**
	 * All registed IssueDiagnostic (This class)
	 */
	private static issueDiagnostics: IssueDiagnostic[] = [];

	/**
	 * All registered vscode diagnostics
	 */
	private static vscodeDiagnostics = vscode.languages.createDiagnosticCollection('w3c_validation_collection');

	/**
	 * The related vscode diagnostic of this issue
	 */
	diagnostic: vscode.Diagnostic;

	/**
	 * The line in the window that contain the issue
	 */
	lineRange: vscode.Range | undefined;

	/**
	 * The text content of the line containing the issue,
	 * at the time the diagnostic is created
	 */
	lineIntialContent: string | undefined;

	/**
	 * Create a new issue diagnostic from a issue message
	 * @param message the message containing all the related data of the issue
	 * @param document the document on which the diagnostic is created
	 */
	constructor(message: IMessage, document: vscode.TextDocument) {
		const lineRange = getLineRange(message.lastLine, document);
		this.diagnostic = IssueDiagnostic.getVSCodeDiagnosticFromMessage(message);
		this.lineRange = lineRange;
		this.lineIntialContent = document.getText(lineRange);
		IssueDiagnostic.issueDiagnostics.push(this);
	}

	static clearAllDiagnostics(): void {
		IssueDiagnostic.issueDiagnostics = [];
		IssueDiagnostic.vscodeDiagnostics.clear();
	}

	static clearErrorsDiagnostics(): void {
		IssueDiagnostic.issueDiagnostics = IssueDiagnostic.issueDiagnostics
			.filter(d =>
				d.diagnostic.severity === vscode.DiagnosticSeverity.Error
			);
	}

	/**
	 * Create a vscode diagnostic from a message
	 * @param  message the message from which the diagnostic will be created
	 * @return diagnostic object
	 */
	static getVSCodeDiagnosticFromMessage = (message: IMessage): vscode.Diagnostic => {
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
			getMessageRange(message),
			message.message,
			severity
		);
		diagnostic.code = 'W3C_validation';
		diagnostic.source = message.type;

		return diagnostic;
	};

	/**
	 * Refresh the diagnostics on the active text editor by reading the content of
	 * the issueDiagnosticList array.
	 * This is called on every changes in the active text editor.
	 * @returns true if there si no diagnostics left on the document
	 */
	static refreshWindowDiagnostics = (): Promise<boolean> => {
		return new Promise((resolve, reject) => {
			if (!vscode.window.activeTextEditor) {
				reject();
				return;// return for ts type check
			}

			//Clearing window's diagnostic
			IssueDiagnostic.vscodeDiagnostics.clear();
			const diagnostics: vscode.Diagnostic[] = [];

			//Auto clear diagnostic on page :
			//For each registered diagnostic in the issueDiagnostic list
			IssueDiagnostic.issueDiagnostics.forEach(element => {
				//We first check if the line of this diagnostic has changed
				//So we compare the initial content of the diagnostic's line with the actual content.
				const currentLineContent = vscode.window.activeTextEditor?.document.getText(element.lineRange);
				if (element.lineIntialContent !== currentLineContent) {
					IssueDiagnostic.issueDiagnostics.splice(
						IssueDiagnostic.issueDiagnostics.indexOf(element), 1
					);
				} else {
					//In case the line has no changes, that means we should keep this diagnostic on page.
					diagnostics.push(element.diagnostic);
				}
			});

			//Adding all remaining diagnostics to page.
			IssueDiagnostic.vscodeDiagnostics.set(
				vscode.window.activeTextEditor.document.uri,
				diagnostics
			);

			resolve(diagnostics.length === 0);
		});
	};
}

