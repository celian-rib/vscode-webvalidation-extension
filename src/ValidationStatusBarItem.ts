import * as vscode from 'vscode';
import { activeFileIsValid } from './utils';

export default class ValidationStatusBarItem {

	/**
	 * The status bar item that start a new file validation
	 */
	static validationItem: ValidationStatusBarItem;

	/**
	 * The status bar itm that clear the file validation
	 */
	static clearValidationItem: ValidationStatusBarItem;

	/**
	 * Initialize all the necessary status bar items for this extension
	 */
	static createValidationItems(): void {
		//Init start validation item
		ValidationStatusBarItem.validationItem = new ValidationStatusBarItem(
			'webvalidator.startvalidation',
			'W3C validation',
			'$(pass)',
			'Start the W3C validation of this file',
			true
		);
		//Init clear validation item
		ValidationStatusBarItem.clearValidationItem = new ValidationStatusBarItem(
			'webvalidator.clearvalidation',
			'Clear W3C validation',
			'$(notifications-clear)',
			'This will clear all issues made by the W3C Web Validator extension',
			false
		);
		ValidationStatusBarItem.updateValidationItemTextVisibility();
	}

	/**
	 * Current item
	 * @see {vscode.StatusBarItem}
	 */
	private readonly item: vscode.StatusBarItem;

	/**
	 * The default text that this item contains
	 * (To change the text use the update method)
	 */
	private readonly defaultIconText: string;

	/**
	 * The default text that this item contains
	 * (To change the text use the update method)
	 */
	private readonly defaultText: string;

	/**
	 * Create a new custom status bar item
	 * @param command the command that this item execute when pressed
	 * @param defaultText the default text value that this item display
	 * @param tooltip The tootltip to show when this item is hovered
	 */
	private constructor(command: string, defaultText: string, defaultIconText: string, tooltip: string, show: boolean) {
		this.defaultText = defaultText;
		this.defaultIconText = defaultIconText;
		this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
		this.item.command = command;
		this.item.tooltip = tooltip;
		this.updateContent();
		this.updateVisibility(show);
	}

	/**
	 * Update the content of this status bar item
	 * @param customText the new text for this item
	 * @param customIcon the new icon fr this item
	 */
	updateContent(customText: string = this.defaultText, customIcon: string = this.defaultIconText): void {
		this.item.text = `${customIcon} ${customText}`.trim();
	}

	/**
	 * Set the visibility of this staus bar item
	 * @param show true to show this item in the status bar
	 */
	updateVisibility(show: boolean): void {
		show ? this.item.show() : this.item.hide();
	}

	/**
	 * Set the startValidation item text visibility depending on the current active editor window
	 */
	static updateValidationItemTextVisibility(): void {
		activeFileIsValid(vscode.window.activeTextEditor?.document, false)
			?
			ValidationStatusBarItem.validationItem.updateContent()
			:
			ValidationStatusBarItem.validationItem.updateContent('');
	}
}
