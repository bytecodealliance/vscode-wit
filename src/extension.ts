import * as vscode from "vscode";
import { WitSyntaxValidator } from "./witValidator.js";

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

        await syntaxCheckCurrentFile(activeEditor, validator);
    });

    // Register syntax check for workspace command
    const syntaxCheckWorkspaceCommand = vscode.commands.registerCommand("wit-idl.syntaxCheckWorkspace", async () => {
        await syntaxCheckWorkspace(validator);
    });

    // Auto-validate on file save
    const onSaveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.languageId === "wit") {
            const editor = vscode.window.visibleTextEditors.find((e) => e.document === document);
            if (editor) {
                await syntaxCheckCurrentFile(editor, validator);
            }
        }
    });

    // Auto-validate on file open
    const onOpenListener = vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (document.languageId === "wit") {
            const editor = vscode.window.visibleTextEditors.find((e) => e.document === document);
            if (editor) {
                await syntaxCheckCurrentFile(editor, validator);
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

/**
 * Perform syntax check on the current active WIT file
 * @param editor - The active text editor
 * @param validator - The WIT syntax validator instance
 */
async function syntaxCheckCurrentFile(editor: vscode.TextEditor, validator: WitSyntaxValidator): Promise<void> {
    const document = editor.document;
    const content = document.getText();

    try {
        // Clear existing diagnostics for this file
        validator.clearDiagnostics(document.uri);

        // Validate the file
        const errorInfo = await validator.validate(document.uri.fsPath, content);

        if (errorInfo) {
            // Create a diagnostic from the error information
            const diagnostic = createDiagnosticFromError(errorInfo, document);

            // Set the diagnostic for this file
            validator.getDiagnosticCollection().set(document.uri, [diagnostic]);

            // Show error message
            vscode.window.showErrorMessage(
                `WIT Syntax Error in ${vscode.workspace.asRelativePath(document.uri)}: ${errorInfo.mainError}`
            );
        } else {
            // Validation succeeded - show success message
            vscode.window.showInformationMessage(`WIT file ${vscode.workspace.asRelativePath(document.uri)} is valid`);
        }
    } catch (error) {
        // Handle unexpected errors
        console.error("Error during WIT validation:", error);
        vscode.window.showErrorMessage(
            `Failed to validate WIT file: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

/**
 * Create a VS Code diagnostic from WIT error information
 * @param errorInfo - The parsed error information
 * @param document - The text document
 * @returns A VS Code diagnostic
 */
function createDiagnosticFromError(
    errorInfo: NonNullable<ReturnType<typeof import("./errorParser.js").extractErrorInfo>>,
    document: vscode.TextDocument
): vscode.Diagnostic {
    // Convert 1-based row/column to 0-based for VS Code
    const line = Math.max(0, (errorInfo.row || 1) - 1);
    const character = Math.max(0, (errorInfo.column || 1) - 1);

    // Try to get the actual line length for better range highlighting
    const documentLine = document.lineAt(Math.min(line, document.lineCount - 1));
    const endCharacter = Math.min(character + 10, documentLine.text.length); // Highlight ~10 characters or to end of line

    const range = new vscode.Range(new vscode.Position(line, character), new vscode.Position(line, endCharacter));

    const message = errorInfo.detailedError || errorInfo.mainError || "Unknown WIT syntax error";

    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);

    // Add additional information
    diagnostic.source = "wit-syntax";
    diagnostic.code = "wit-parse-error";

    if (errorInfo.mainError && errorInfo.detailedError) {
        diagnostic.relatedInformation = [
            new vscode.DiagnosticRelatedInformation(
                new vscode.Location(document.uri, range),
                `Context: ${errorInfo.mainError}`
            ),
        ];
    }

    return diagnostic;
}

/**
 * Perform syntax check on all WIT files in the workspace
 * @param validator - The WIT syntax validator instance
 */
async function syntaxCheckWorkspace(validator: WitSyntaxValidator): Promise<void> {
    const witFiles = await vscode.workspace.findFiles("**/*.wit", "**/node_modules/**");

    if (witFiles.length === 0) {
        vscode.window.showInformationMessage("No WIT files found in workspace");
        return;
    }

    // Clear all existing diagnostics
    validator.clearAllDiagnostics();

    let totalErrors = 0;
    let totalFiles = 0;
    const validFiles: string[] = [];
    const errorFiles: string[] = [];

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Checking WIT files syntax...",
            cancellable: false,
        },
        async (progress) => {
            for (let i = 0; i < witFiles.length; i++) {
                const file = witFiles[i];
                const fileName = vscode.workspace.asRelativePath(file);

                progress.report({
                    message: `Checking ${fileName} (${i + 1}/${witFiles.length})`,
                    increment: 100 / witFiles.length,
                });

                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const content = document.getText();
                    const errorInfo = await validator.validate(document.uri.fsPath, content);

                    totalFiles++;

                    if (errorInfo) {
                        // Create and set diagnostic
                        const diagnostic = createDiagnosticFromError(errorInfo, document);
                        validator.getDiagnosticCollection().set(document.uri, [diagnostic]);

                        totalErrors++;
                        errorFiles.push(fileName);
                    } else {
                        // File is valid
                        validFiles.push(fileName);
                    }
                } catch (error) {
                    console.error(`Error checking ${fileName}:`, error);
                    totalErrors++;
                    errorFiles.push(fileName);
                }
            }
        }
    );

    // Show summary
    const validCount = totalFiles - totalErrors;
    const message = `WIT Syntax Check Complete: ${validCount}/${totalFiles} files valid, ${totalErrors} error(s)`;

    if (totalErrors > 0) {
        vscode.window.showErrorMessage(message);

        // Show details in output channel
        const outputChannel = vscode.window.createOutputChannel("WIT Syntax Check");
        outputChannel.appendLine("WIT Syntax Check Results:");
        outputChannel.appendLine(`Total files checked: ${totalFiles}`);
        outputChannel.appendLine(`Valid files: ${validCount}`);
        outputChannel.appendLine(`Files with errors: ${totalErrors}`);

        if (errorFiles.length > 0) {
            outputChannel.appendLine("\nFiles with errors:");
            errorFiles.forEach((file) => outputChannel.appendLine(`  - ${file}`));
        }

        if (validFiles.length > 0) {
            outputChannel.appendLine("\nValid files:");
            validFiles.forEach((file) => outputChannel.appendLine(`  - ${file}`));
        }

        outputChannel.show();
    } else {
        vscode.window.showInformationMessage(message);
    }
}

export function deactivate() {
    // Extension cleanup is handled by context.subscriptions
}
