import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as utils from '../../utils';
import IssueDiagnostic from '../../IssueDiagnostic';
import { IMessage } from '../../ValidationFile';

suite('Extension Test Suite', () => {

	const getTextDocument = async (): Promise<vscode.TextDocument> => {
		return new Promise<vscode.TextDocument>((resolve) => {
			vscode.workspace.openTextDocument({ language: 'html', content: '<>' }).then(doc => {
				resolve(doc);
			});
		});
	};

	/**
	 * Check the setup for unit testing with vscode
	 */
	test('Sample test', async () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(1, [1, 2, 3].indexOf(2));
		const document = await getTextDocument();
		assert.ok(document != null);
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
		assert.ok(utils.activeFileIsValid(document));
		assert.ok(!utils.activeFileIsValid(undefined));
	});

	const sampleData: IMessage = {
		extract: 'bonsoir',
		firstColumn: 10,
		hiliteLength: 20,
		hiliteStart: 2,
		lastColumn: 10,
		lastLine: 3,
		message: 'Attribute is not allowed here',
		type: 'error',
		firstLine: 3
	};

	/**
	 * Test of getVSCodeDiagnosticFromMessage()
	 */
	test('getVSCodeDiagnosticFromMessage()', () => {
		const diagnostic: vscode.Diagnostic = IssueDiagnostic.getVSCodeDiagnosticFromMessage(sampleData);
		assert.strictEqual(diagnostic.message, sampleData.message);
		assert.strictEqual(diagnostic.severity, vscode.DiagnosticSeverity.Error);
		assert.strictEqual(diagnostic.code, 'W3C_validation');
		assert.strictEqual(diagnostic.source, sampleData.type);
	});

	/**
	 * Test of getRange()
	 */
	test('getRange()', () => {
		const range: vscode.Range = utils.getMessageRange(sampleData);
		assert.deepStrictEqual(range.start, new vscode.Position(sampleData.lastLine - 1, sampleData.hiliteStart - 1));
		assert.deepStrictEqual(range.end, new vscode.Position(sampleData.lastLine - 1, sampleData.hiliteStart - 1 + sampleData.hiliteLength));
	});

	/**
	 * Test of getlineRange()
	 */
	test('getLineRange()', async () => {
		const document = await getTextDocument();
		const  range = utils.getLineRange(sampleData.lastLine, document);
		assert.strictEqual(range, undefined);
	});

});
