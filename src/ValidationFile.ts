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

	private async addPartialHTMLStructure(): Promise<string> {
		const completeHeader = `
		<!DOCTYPE html>
		<html lang="en">
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
