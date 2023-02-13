import * as https from 'https';
import * as vscode from 'vscode';
import axios, { AxiosError, AxiosResponse } from 'axios';
import IssueDiagnostic from './IssueDiagnostic';
import ValidationStatusBarItem from './ValidationStatusBarItem';

const W3C_API_URL = 'https://validator.w3.org/nu/?out=json';

/**
 * Messages are elements sends as issues by the W3C validation API
 */
export interface IMessage {
	extract: string,
	firstColumn: number,
	hiliteLength: number,
	hiliteStart: number,
	lastColumn: number,
	firstLine: number,
	lastLine: number,
	message: string,
	type: string
}

export class ValidationFile {

	private document: vscode.TextDocument;

	/**
	 * If this file does not contains the basic HTML structure,
	 * it is considered as a partial HTML file
	 */
	private isPartialHTML: boolean;
	private partialHeaderAddedLines: number;

	constructor(document: vscode.TextDocument) {
		this.document = document;
		this.partialHeaderAddedLines = 0;
		this.isPartialHTML = false;
		this.checkForPartialHTML();
	}

	public get content(): string {
		return this.document.getText();
	}

	public async startValidation(): Promise<void> {
		ValidationStatusBarItem.validationItem.updateContent('Loading', '$(sync~spin)');
		IssueDiagnostic.clearDiagnostics(false);

		const w3cResponse = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'W3C validation ...',
			cancellable: false,
		}, this.fetchW3CValidation);

		if (w3cResponse == null) {
			ValidationStatusBarItem.validationItem.updateContent();
			return;
		}

		console.log(w3cResponse.data);

		const messages: IMessage[] = w3cResponse.data.messages;

		if (messages == null) {
			vscode.window.showErrorMessage('Error : incorrect response from W3C...');
			return;
		}

		this.handleW3CMessages(messages);
	}

	private handleW3CMessages = (messages: IMessage[]): void => {
		const showNotif = vscode.workspace.getConfiguration('webvalidator').validationNotification;

		if (messages.length == 0) {
			showNotif && vscode.window.showInformationMessage(`This ${this.document.languageId.toUpperCase()} file is valid !`);
			ValidationStatusBarItem.validationItem.updateContent('File is valid');
			setTimeout(() => ValidationStatusBarItem.validationItem.updateContent(), 2000);
			return;
		}

		if (this.isPartialHTML)
			this.removePartialHTMLHeader(messages);

		IssueDiagnostic.createDiagnostics(messages, this.document, showNotif);

		ValidationStatusBarItem.clearValidationItem.updateVisibility(true);
		ValidationStatusBarItem.validationItem.updateContent();
	}

	private fetchW3CValidation = async (): Promise<AxiosResponse | null> => {
		let content = this.content;

		if (this.isPartialHTML)
			content = await this.addPartialHTMLStructure();

		try {
			return await axios.post(W3C_API_URL, content, {
				headers: { 'Content-type': `text/${this.document.languageId.toLowerCase()}; charset=utf-8` },
				httpsAgent: new https.Agent({ rejectUnauthorized: false })
			});
		} catch (error) {
			if ((error as AxiosError)?.code == 'ENOTFOUND') {
				vscode.window.showErrorMessage('W3C service not reachable, please check your internet connection.');
				return null;
			}
			if ((error as AxiosError)?.response?.status === 503) { // W3C down (probably)
				vscode.window.showErrorMessage('W3C service currently unavailable. Please retry later...');
				return null;
			}
			vscode.window.showErrorMessage('W3C Validation : an error occured.');
			return null;
		}
	};

	private checkForPartialHTML() {
		if (this.document.languageId.toUpperCase() !== 'HTML')
			return;
		this.isPartialHTML = !this.content.startsWith('<!DOCTYPE html');
	}

	private async getPartialHTMLDoctype(): Promise<vscode.QuickPickItem> {
		const config = vscode.workspace.getConfiguration('webvalidator').get('partialHtmlDoctype') as string;

		const quickPick = vscode.window.createQuickPick();

		quickPick.title = 'This HTML file is partial, select the DOCTYPE to add to the file :';

		quickPick.items = [
			{
				label: 'HTML5',
				description: 'Add the default HTML5 structure',
				detail: '<!DOCTYPE html>\n<html lang="en">',
			},
			{
				label: 'XHTML 1.0 Strict',
				description: 'A strict and well-formed version of XHTML.',
				detail: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n<html xmlns="http://www.w3.org/1999/xhtml" lang="en">',
			},
			{
				label: 'XHTML 1.0 Transitional',
				description: 'A transitional version of XHTML.',
				detail: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n<html xmlns="http://www.w3.org/1999/xhtml" lang="en">',
			},
			{
				label: 'HTML 4.01 Strict',
				description: 'A strict version of HTML 4.01.',
				detail: '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">\n<html lang="en">',
			},
			{
				label: 'HTML 4.01 Transitional',
				description: 'A version of HTML 4.01.',
				detail: '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">\n<html lang="en">',
			},
		];

		if (!config.toLowerCase().includes('ask')) {
			const configItem = quickPick.items.find((item) => item.label.toLowerCase() === config.toLowerCase());
			if (configItem != null)
				return configItem;
		}

		// show the quick pick and wait for the user to select an item
		quickPick.show();

		return await new Promise<vscode.QuickPickItem>((resolve) => {
			quickPick.onDidAccept(() => {
				resolve(quickPick.selectedItems[0]);
				quickPick.hide();
			});
			quickPick.onDidHide(() => {
				resolve(quickPick.items[0]);
				quickPick.dispose();
			});
		});
	}

	private async addPartialHTMLStructure(): Promise<string> {
		const partialDoctypeHeader = await this.getPartialHTMLDoctype();

		this.partialValidationPreferences(partialDoctypeHeader);

		const completeHeader = `${partialDoctypeHeader.detail}
		<head>
		<title>Partial HTML Document</title>
		</head>
		<body>`;

		const completeFooter = '</body>\n</html>';

		this.partialHeaderAddedLines = completeHeader.split('\n').length;

		let processedContent = this.content.trim();

		if (this.content.startsWith('<body>') && this.content.endsWith('</body>')) {
			this.partialHeaderAddedLines -= 1; // Removed body tag
			processedContent = this.content.substring(6, this.content.length - 7).trim();
		}

		return `${completeHeader}
				${processedContent}
				${completeFooter}`;
	}

	private async partialValidationPreferences(partialDoctypeHeader: vscode.QuickPickItem): Promise<void> {
		const config = vscode.workspace.getConfiguration('webvalidator');

		if (config.get('validationNotification') == false)
			return;

		const asked: boolean = (config.get('partialHtmlDoctype') as string).toLowerCase().includes('ask');
		const options = asked ? [`Always validate as ${partialDoctypeHeader.label}`, 'Set default (Settings)'] : ['Change default DOCTYPE for partial HTML files'];

		const preference = await vscode.window.showInformationMessage(`Validating partial HTML file as ${partialDoctypeHeader.label}`,
			...(options));

		if (preference?.toLowerCase().includes('always'))
			config.update('partialHtmlDoctype', partialDoctypeHeader.label, true);
		else if (preference?.toLowerCase().includes('default'))
			vscode.commands.executeCommand('workbench.action.openSettings', 'webvalidator.partialHtmlDoctype');
	}

	private removePartialHTMLHeader(messages: IMessage[]) {
		const maxLines = this.document.lineCount;
		messages.forEach((message) => {
			message.lastLine -= this.partialHeaderAddedLines;
			if (message.firstLine < 0)
				message.firstLine = 0;
			if (message.firstLine > maxLines)
				message.firstLine = maxLines;
			if (message.lastLine < 0)
				message.lastLine = 0;
			if (message.lastLine > maxLines)
				message.lastLine = maxLines;
		});
	}
}
