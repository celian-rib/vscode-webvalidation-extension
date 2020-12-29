// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const axios = require('axios').default;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('webvalidator.startvalidation', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		console.log("Validation asked");

		if(!vscode.window.activeTextEditor){
			vscode.window.showInformationMessage('Open an HTML file first');
			return;
		}
		if(vscode.window.activeTextEditor.document.languageId != "html"){
			vscode.window.showInformationMessage('Not an HTML file.');
			return;
		}

		vscode.window.showInformationMessage('W3C Validation starting on this HTML file !');

		const filecontent = vscode.window.activeTextEditor.document.getText();
		// console.log(filecontent);

		const headers = {
			'Content-type': 'text/html; charset=utf-8',
		}
		/*
		//mdr dfacon ya rien qui marche
		// https://validator.w3.org/nude/send

		//
		//wtf are you doing, aaaaaaah ok
		//file content = le fichier en text quoi
		
		essmdar rageuxye 
		essaye ça
		okay
		YAYAYAYAAAAA c plus la meme erreur
		x) enfin
		envoie l'erreur
		tu vois pas le terminal debug ?
		c'est buggé (jvois rien)
		AAAAAAAHHHHHHHH MAIS MEC
		CEST LES ERREURS DU CODE HTML QUI RESPECTE PAS W3C
		DONC CA MARCHE
		envoie le json de reponse
		wow tu va te calmer oui
		voilà
		//Oui si ya pas d'erreur ca fais une erreur vu que tu cherches une erreur
ça 		je test
si y'a pas d'erreur ça retourne 200 quand même ?
		jte montre le json quand ya pas d'erreur , vasy
		messages.lenght == 0 non ?
		ah yes
		je test ? yep go
		c bon ca marche
		nice
		merci bg 
		backend magician: gilfoyle le sang mdr
		jtai mis un easter egg dans un fichier, aller salut dude !
		 */
		axios.post('https://validator.w3.org/nu/?out=json', filecontent, {
			headers: headers,
		})
		.then(function (response) {
			// console.log(response);
			// console.log(response.data.messages[0].type);
			// 
			if (response.data) {
				if (response.data.messages.length > 0){
					vscode.window.showErrorMessage('Errors found');
					const errors = response.data.messages;
					// errors.forEach(error => {
						
					// });
					vscode.window.showErrorMessage("l" + errors[0].lastLine + " " + errors[0].message); 
					// vscode.window.showInformationMessage(response.data.messages[0].subType + " : " + response.data.messages[0].type);
				} else {
					vscode.window.showInformationMessage('No errors found');
				}
			} else {
				vscode.window.showErrorMessage('200, No data');
			}
		})
		.catch(function (error) {
			console.log(error);
			vscode.window.showErrorMessage('An error occured.');
		});

	});

	context.subscriptions.push(disposable);
}
// @ts-ignore
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	// @ts-ignore
	activate,
	deactivate
}
