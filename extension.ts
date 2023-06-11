import {workspace, type ExtensionContext} from 'vscode';
import {LanguageClient} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	client = new LanguageClient(
		'witLanguageClient',
		'WIT Language Client',
		{
			command: context.asAbsolutePath('./out/server/wit-lsp'),
		},
		{
			documentSelector: [{
				language: 'wit',
				pattern: '**/*.wit',
			}],
			synchronize: {
				fileEvents: workspace.createFileSystemWatcher('**/*.wit'),
			},
		},
	);

	// eslint-disable-next-line @typescript-eslint/no-floating-promises
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}

	return client.stop();
}
