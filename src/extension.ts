import * as vscode from "vscode";
import { WitSyntaxValidator } from "./validator.js";

const builtinTypes = [
    "u8",
    "u16",
    "u32",
    "u64",
    "s8",
    "s16",
    "s32",
    "s64",
    "float32",
    "float64",
    "char",
    "bool",
    "string",
    "tuple",
    "list",
    "option",
    "result",
    "borrow",
];

const keywords = [
    "_",
    "as",
    "constructor",
    "enum",
    "export",
    "flags",
    "func",
    "import",
    "include",
    "interface",
    "package",
    "record",
    "resource",
    "static",
    "type",
    "use",
    "variant",
    "with",
    "world",
];

const staticCompletions = new vscode.CompletionList(
    [
        ...keywords.map((keyword) => new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword)),
        ...builtinTypes.map((type) => new vscode.CompletionItem(type, vscode.CompletionItemKind.Struct)),
    ],
    /* isIncomplete: */ true
);

export function activate(context: vscode.ExtensionContext) {
    // Create a single validator instance to share the diagnostic collection
    const validator = new WitSyntaxValidator();

    // VSCode does not support having both its built-in suggestions _and_ a custom completion provider.
    // But, without a proper LSP, we do want both!
    // Registering the provider directly on "wit" would disable VSCode's built-in suggestions.
    // The workaround is to register it for all languages (`*`) and then dynamically check the document type.
    const provider = vscode.languages.registerCompletionItemProvider("*", {
        provideCompletionItems(
            document: vscode.TextDocument,
            position: vscode.Position,
            token: vscode.CancellationToken,
            context: vscode.CompletionContext
        ) {
            if (document.languageId !== "wit") {
                return;
            }

            return staticCompletions;
        },
    });

    // Register syntax check command
    const syntaxCheckCommand = vscode.commands.registerCommand("wit-idl.syntaxCheck", async () => {
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor) {
            vscode.window.showWarningMessage("No active editor found");
            return;
        }

        if (activeEditor.document.languageId !== "wit") {
            vscode.window.showWarningMessage("Active file is not a WIT file");
            return;
        }

        await validator.syntaxCheckCurrentFile(activeEditor);
    });

    // Register syntax check for workspace command
    const syntaxCheckWorkspaceCommand = vscode.commands.registerCommand("wit-idl.syntaxCheckWorkspace", async () => {
        await validator.syntaxCheckWorkspace();
    });

    // Auto-validate on file save
    const onSaveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.languageId === "wit") {
            const editor = vscode.window.visibleTextEditors.find((e) => e.document === document);
            if (editor) {
                await validator.syntaxCheckCurrentFile(editor);
            }
        }
    });

    // Auto-validate on file open
    const onOpenListener = vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (document.languageId === "wit") {
            const editor = vscode.window.visibleTextEditors.find((e) => e.document === document);
            if (editor) {
                await validator.syntaxCheckCurrentFile(editor);
            }
        }
    });

    // Clear diagnostics when file is closed
    const onCloseListener = vscode.workspace.onDidCloseTextDocument((document) => {
        if (document.languageId === "wit") {
            validator.clearDiagnostics(document.uri);
        }
    });

    context.subscriptions.push(
        provider,
        syntaxCheckCommand,
        syntaxCheckWorkspaceCommand,
        onSaveListener,
        onOpenListener,
        onCloseListener,
        validator.getDiagnosticCollection()
    );
}

export function deactivate() {
    // Extension cleanup is handled by context.subscriptions
}
