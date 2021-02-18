import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as extension from '../../extension';

var rewire = require("rewire");
const validator = rewire('../../extension');
const activeFileIsValid = validator.__get__('activeFileIsValid');
const getDiagnostic = validator.__get__('getDiagnostic');
const getRange = validator.__get__('getRange');
const getLineRange = validator.__get__('getLineRange');

suite('Extension Test Suite', () => {

	const getTextDocument = async (): Promise<vscode.TextDocument> => {
		return new Promise<vscode.TextDocument>((resolve) => {
			vscode.workspace.openTextDocument({language: 'html', content: '<>'}).then(doc => {
				resolve(doc);
			});
		});
	};

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
	test('Launch setup for vscode', async () => {
		const document = await getTextDocument();
		assert.ok(document != undefined);
		assert.deepStrictEqual(document.languageId, 'html');
	});
	
	/**
	 * Test of activaFileisValid()
	 */
	test('activeFileIsValid()', async () => {
		const document = await getTextDocument();
		assert.ok(activeFileIsValid(document));
		assert.ok(!activeFileIsValid(undefined));
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
		const diagnostic: vscode.Diagnostic = getDiagnostic(sampleData);
		assert.strictEqual(diagnostic.message, sampleData.message);
		assert.strictEqual(diagnostic.severity, vscode.DiagnosticSeverity.Error);
		assert.strictEqual(diagnostic.code, 'web_validator');
		assert.strictEqual(diagnostic.source, sampleData.type);
	});
	
	/**
	 * Test of getRange()
	 */
	test('getRange()', () => {
		const range: vscode.Range = getRange(sampleData);
		assert.deepStrictEqual(range.start, new vscode.Position(sampleData.lastLine - 1, sampleData.hiliteStart - 1));
		assert.deepStrictEqual(range.end, new vscode.Position(sampleData.lastLine - 1, sampleData.hiliteStart - 1 + sampleData.hiliteLength));
	});

	/**
	 * Test of getlineRange()
	 */
	test('getLineRange()', async () => {
		const document = await getTextDocument();
		const  range = getLineRange(sampleData.lastLine, document);
		assert.strictEqual(range, undefined);
	});
	
});
