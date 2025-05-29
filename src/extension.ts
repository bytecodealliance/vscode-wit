import * as vscode from "vscode";

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

    context.subscriptions.push(provider);
}

export function deactivate() {}
