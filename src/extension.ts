import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { WitSyntaxValidator } from "./validator.js";
import { getWitBindgenVersionFromWasm, generateBindingsFromWasm } from "./wasmUtils.js";

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
    true
);

export function activate(context: vscode.ExtensionContext) {
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

    const syntaxCheckWorkspaceCommand = vscode.commands.registerCommand("wit-idl.syntaxCheckWorkspace", async () => {
        await validator.syntaxCheckWorkspace();
    });

    const showVersionCommand = vscode.commands.registerCommand("wit-idl.showVersion", async () => {
        try {
            const version = await getWitBindgenVersionFromWasm();
            vscode.window.showInformationMessage(`WIT Bindgen WASM Version: ${version}`);
        } catch (error) {
            console.error("Failed to get WIT bindgen version:", error);
            vscode.window.showErrorMessage(
                `Failed to get WIT bindgen version: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    });

    /**
     * Create a binding generation command for a specific language
     * @param language - The target language for bindings
     * @param languageLabel - The display label for the language
     * @returns The command registration
     */
    const createGenerateBindingsCommand = (language: string, languageLabel: string) => {
        return vscode.commands.registerCommand(`wit-idl.generateBindings${languageLabel}`, async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage("No active editor found. Please open a .wit file.");
                return;
            }

            if (editor.document.languageId !== "wit") {
                vscode.window.showErrorMessage("Active file is not a WIT file. Please open a .wit file.");
                return;
            }

            try {
                const content = editor.document.getText();
                if (!content.trim()) {
                    vscode.window.showWarningMessage("The .wit file is empty.");
                    return;
                }

                const worldMatch = content.match(/world\s+([a-zA-Z][a-zA-Z0-9-_]*)/g);
                let selectedWorld: string | undefined;

                const workspaceFolders = vscode.workspace.workspaceFolders;
                const defaultUri = workspaceFolders ? workspaceFolders[0].uri : undefined;

                const outputUri = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    defaultUri,
                    openLabel: "Select Output Directory",
                    title: `Select directory for ${languageLabel} bindings`,
                });

                if (!outputUri || outputUri.length === 0) {
                    return;
                }

                const outputPath = outputUri[0].fsPath;

                const bindingFiles = await generateBindingsFromWasm(content, language, selectedWorld);

                // Check if generation failed or returned error files
                const fileEntries = Object.entries(bindingFiles);
                const errorFile = fileEntries.find(([filename]) => filename === "error.txt");

                if (errorFile) {
                    // There's an explicit error file - parse and report error to problems pane
                    const errorMessage = errorFile[1];
                    const parsedError = validator.parseWitBindgenError(errorMessage, editor.document.uri.fsPath);

                    if (parsedError) {
                        const diagnostic = validator.createDiagnosticFromError(parsedError, editor.document);
                        validator.getDiagnosticCollection().set(editor.document.uri, [diagnostic]);
                    } else {
                        // Fallback if parsing fails
                        const cleanMessage = errorMessage.replace(/^\/\/\s*/, "").replace(/\n\/\/\s*/g, "\n");
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(0, 0, 0, 1),
                            `Failed to generate ${languageLabel} bindings: ${cleanMessage}`,
                            vscode.DiagnosticSeverity.Error
                        );
                        diagnostic.source = "wit-bindgen";
                        diagnostic.code = "binding-generation-error";
                        validator.getDiagnosticCollection().set(editor.document.uri, [diagnostic]);
                    }
                    return;
                }

                if (fileEntries.length === 0) {
                    // No files generated and no explicit error - parse and report to problems pane
                    const errorMessage =
                        "No files were generated. This may be due to invalid WIT syntax or unsupported features.";
                    const parsedError = validator.parseWitBindgenError(errorMessage, editor.document.uri.fsPath);

                    if (parsedError) {
                        const diagnostic = validator.createDiagnosticFromError(parsedError, editor.document);
                        validator.getDiagnosticCollection().set(editor.document.uri, [diagnostic]);
                    } else {
                        // Fallback if parsing fails
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(0, 0, 0, 1),
                            `Failed to generate ${languageLabel} bindings: ${errorMessage}`,
                            vscode.DiagnosticSeverity.Error
                        );
                        diagnostic.source = "wit-bindgen";
                        diagnostic.code = "binding-generation-error";
                        validator.getDiagnosticCollection().set(editor.document.uri, [diagnostic]);
                    }
                    return;
                }

                // Clear any existing binding generation errors since we're about to succeed
                const existingDiagnostics = validator.getDiagnosticCollection().get(editor.document.uri) || [];
                const filteredDiagnostics = existingDiagnostics.filter((d) => d.source !== "wit-bindgen");
                validator.getDiagnosticCollection().set(editor.document.uri, filteredDiagnostics);

                const writtenFiles: string[] = [];
                for (const [filename, fileContent] of fileEntries) {
                    const sanitizedFilename = path.basename(filename);
                    const filePath = path.join(outputPath, sanitizedFilename);

                    const dir = path.dirname(filePath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    const binaryData = Buffer.from(fileContent, "latin1");
                    fs.writeFileSync(filePath, binaryData);
                    writtenFiles.push(sanitizedFilename);
                }

                const fileCount = writtenFiles.length;
                vscode.window.showInformationMessage(
                    `${languageLabel} bindings generated successfully! ${fileCount} file${
                        fileCount > 1 ? "s" : ""
                    } written to ${outputPath}`
                );

                const mainFiles = ["src/lib.rs", "main.c", "Program.cs", "main.go", "main.mbt"];
                const mainFile = mainFiles.find((f) => writtenFiles.includes(f)) || writtenFiles[0];

                if (mainFile) {
                    const mainFilePath = path.join(outputPath, mainFile);
                    const doc = await vscode.workspace.openTextDocument(mainFilePath);
                    await vscode.window.showTextDocument(doc);
                }
            } catch (error) {
                console.error("Failed to generate bindings:", error);
                // Parse and report error to problems pane instead of dialog
                const errorMessage = error instanceof Error ? error.message : String(error);
                const parsedError = validator.parseWitBindgenError(errorMessage, editor.document.uri.fsPath);

                if (parsedError) {
                    const diagnostic = validator.createDiagnosticFromError(parsedError, editor.document);
                    validator.getDiagnosticCollection().set(editor.document.uri, [diagnostic]);
                } else {
                    // Fallback if parsing fails
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(0, 0, 0, 1),
                        `Failed to generate bindings: ${errorMessage}`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.source = "wit-bindgen";
                    diagnostic.code = "binding-generation-error";
                    validator.getDiagnosticCollection().set(editor.document.uri, [diagnostic]);
                }
            }
        });
    };

    // Create individual language binding commands
    const generateRustBindingsCommand = createGenerateBindingsCommand("rust", "Rust");
    const generateCBindingsCommand = createGenerateBindingsCommand("c", "C");
    const generateCSharpBindingsCommand = createGenerateBindingsCommand("csharp", "CSharp");
    const generateGoBindingsCommand = createGenerateBindingsCommand("go", "Go");
    const generateMoonBitBindingsCommand = createGenerateBindingsCommand("moonbit", "MoonBit");

    const onSaveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.languageId === "wit") {
            const editor = vscode.window.visibleTextEditors.find((e) => e.document === document);
            if (editor) {
                await validator.syntaxCheckCurrentFile(editor);
            }
        }
    });

    const onOpenListener = vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (document.languageId === "wit") {
            const editor = vscode.window.visibleTextEditors.find((e) => e.document === document);
            if (editor) {
                await validator.syntaxCheckCurrentFile(editor);
            }
        }
    });

    const onCloseListener = vscode.workspace.onDidCloseTextDocument((document) => {
        if (document.languageId === "wit") {
            validator.clearDiagnostics(document.uri);
        }
    });

    context.subscriptions.push(
        provider,
        syntaxCheckCommand,
        syntaxCheckWorkspaceCommand,
        showVersionCommand,
        generateRustBindingsCommand,
        generateCBindingsCommand,
        generateCSharpBindingsCommand,
        generateGoBindingsCommand,
        generateMoonBitBindingsCommand,
        onSaveListener,
        onOpenListener,
        onCloseListener,
        validator.getDiagnosticCollection()
    );
}

export function deactivate() {
    // Extension cleanup is handled by context.subscriptions
}
