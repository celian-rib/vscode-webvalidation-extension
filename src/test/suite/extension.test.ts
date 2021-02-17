import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as extension from '../../extension';
const validator = require('../../extension');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	/**
	 * Check the setup for unit testing with vscode
	 */
	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(1, [1, 2, 3].indexOf(2));
	});

	/**
	 * Check if a, html file has been opened for testing the extension
	 */
	test('Launch setup for vscode', () => {
		const document = vscode.window.activeTextEditor?.document;
		assert.ok(document != undefined);
		assert.deepStrictEqual(document.languageId, 'html');
	});
	
	/**
	 * Test of activaFileisValid()
	 */
	test('activeFileIsValid()', () => {
		const document = vscode.window.activeTextEditor?.document;
		if(!document)
			return;

		assert.ok(validator.activeFileIsValid(document));
		assert.ok(!validator.activeFileIsValid(undefined));
	});

	const sampleData: extension.IMessage = {
		extract: 'bonsoir',
		firstColumn: 10,
		hiliteLength: 20,
		hiliteStart: 2,
		lastColumn: 10,
		lastLine: 3,
		message: 'Attribute is not allowed here',
		type: 'error'
	};

	/**
	 * Test of getDiagnostic()
	 */
	test('getDiagnostic()', () => {
		const document = vscode.window.activeTextEditor?.document;
		if(!document)
			return;
		const diagnostic: vscode.Diagnostic = validator.getDiagnostic(sampleData);
		assert.strictEqual(diagnostic.message, sampleData.message);
		assert.strictEqual(diagnostic.severity, vscode.DiagnosticSeverity.Error);
		assert.strictEqual(diagnostic.code, 'web_validator');
		assert.strictEqual(diagnostic.source, sampleData.type);
	});
	
	/**
	 * Test of getRange()
	 */
	test('getRange()', () => {
		const document = vscode.window.activeTextEditor?.document;
		if(!document)
			return;
		const range: vscode.Range = validator.getRange(sampleData);
		assert.deepStrictEqual(range.start, new vscode.Position(sampleData.lastLine - 1, sampleData.hiliteStart - 1));
		assert.deepStrictEqual(range.end, new vscode.Position(sampleData.lastLine - 1, sampleData.hiliteStart - 1 + sampleData.hiliteLength));
	});
	
});
