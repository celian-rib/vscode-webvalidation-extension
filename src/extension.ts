// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import IssueDiagnostic from './IssueDiagnostic';
import * as validation from './validation';

/**
 * Messages are elements sends as issues by the W3C validation API
 */
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
 * This method is called when the extension is activated
 * The extension is activated on launch or on the very
 * first time the command is executed
 * The main goal of this method is to register all available commands such
 * as "start validation" or "clear diagnostic"
 * @param context
 */
export const activate = (context: vscode.ExtensionContext): void => {

	//Creating the button in status bar on launch
	validation.updateStatusBarItem();

	// The commands are defined in the package.json file

	//Subscribe start validation command
	context.subscriptions.push(
		vscode.commands.registerCommand('webvalidator.startvalidation', () => {
			validation.startValidation();
		})
	);

	//Subscribe clear validation command
	context.subscriptions.push(
		vscode.commands.registerCommand('webvalidator.clearvalidation', () => {
			validation.clearDiagnosticsListAndUpdateWindow();
		})
	);

	//Subscribe onDidChangeTextDocument (Every time the active text document is modified)
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(() => {
			IssueDiagnostic.refreshWindowDiagnostics().then(allCleared => {
				allCleared && validation.updateStatusBarItemClearButton(true);
			});
		})
	);

	//Subscribe onDidChangeActiveTextEditor
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => {
			validation.updateStatusBarItem();
		})
	);

	console.log('W3C web validation extension activated !');
};
