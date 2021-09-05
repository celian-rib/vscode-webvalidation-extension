## Project setup :

- [Fork](https://github.com/celian-rib/vscode-webvalidation-extension/fork) the project
- Install dependencies : ```npm i```
- Create your feature branch

## Start the project :

- Open debug tab in vscode
- Select run extension
- Run

## Run tests :

- Open debug tab in vscode
- Select extension tests
- Run


***
### Create new release :

- Update ./CHANGELOG.md
- Install vsce ```npm install -g vsce```
- Bump version in package.json
- create vsix package ```vsce package```