import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import { WitSyntaxValidator } from "./validator.js";
import { WitFormatter } from "./formatter.js";
import { isWasmComponentFile } from "./wasmDetection.js";
import {
    getWitBindgenVersionFromWasm,
    extractWitFromComponent,
    generateBindingsFromWasm,
    extractCoreWasmFromComponent,
} from "./wasmUtils.js";

class WitExtractContentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
    private readonly _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    private readonly _watchers = new Map<string, vscode.FileSystemWatcher>();

    readonly onDidChange: vscode.Event<vscode.Uri> = this._onDidChangeEmitter.event;

    dispose(): void {
        for (const w of this._watchers.values()) {
            w.dispose();
        }
        this._watchers.clear();
        this._onDidChangeEmitter.dispose();
    }

    private getSourceFileUri(virtualUri: vscode.Uri): vscode.Uri {
        return virtualUri.with({ scheme: "file" });
    }

    private ensureWatcherFor(virtualUri: vscode.Uri): void {
        const source = this.getSourceFileUri(virtualUri);
        const key = source.fsPath;
        if (this._watchers.has(key)) return;
        const watcher = vscode.workspace.createFileSystemWatcher(source.fsPath);
        const onChange = watcher.onDidChange(() => this._onDidChangeEmitter.fire(virtualUri));
        const onCreate = watcher.onDidCreate(() => this._onDidChangeEmitter.fire(virtualUri));
        const onDelete = watcher.onDidDelete(() => this._onDidChangeEmitter.fire(virtualUri));
        this._watchers.set(key, {
            dispose: () => {
                onChange.dispose();
                onCreate.dispose();
                onDelete.dispose();
                watcher.dispose();
            },
        } as vscode.FileSystemWatcher);
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        try {
            this.ensureWatcherFor(uri);
            const source = this.getSourceFileUri(uri);
            const bytes: Uint8Array = await vscode.workspace.fs.readFile(source);
            const witText: string = await extractWitFromComponent(bytes);
            return witText;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `// Failed to extract WIT for ${uri.path}\n// ${msg}\n`;
        }
    }
}

class ComponentDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChange.event;

    async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
        if (uri.scheme !== "file") return;
        if (!uri.fsPath.toLowerCase().endsWith(".wasm")) return;

        try {
            const isComp = await isWasmComponentFile(uri.fsPath);
            if (!isComp) return;

            const deco = new vscode.FileDecoration("🧩", "WebAssembly Component");
            deco.propagate = false;
            return deco;
        } catch {
            return;
        }
    }

    refresh(uri?: vscode.Uri) {
        this._onDidChange.fire(uri);
    }
}

class WasmToWitOpenRedirectProvider implements vscode.CustomReadonlyEditorProvider {
    static readonly viewType = "wit-idl.wasmToWit";

    async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument & { isComponent?: boolean }> {
        let isComponent: boolean | undefined;
        try {
            isComponent = await isWasmComponentFile(uri.fsPath);
        } catch {
            isComponent = undefined;
        }
        return {
            uri,
            isComponent,
            dispose: () => {
                /* no-op */
            },
        } as vscode.CustomDocument & { isComponent?: boolean };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument & { isComponent?: boolean },
        webviewPanel: vscode.WebviewPanel
    ): Promise<void> {
        const filePath: string = document.uri.fsPath;
        if (document.isComponent === false) {
            await vscode.commands.executeCommand("vscode.openWith", document.uri, "default");
            webviewPanel.dispose();
            return;
        }
        if (document.isComponent !== true) {
            try {
                const headerIsComponent = await isWasmComponentFile(filePath);
                if (!headerIsComponent) {
                    await vscode.commands.executeCommand("vscode.openWith", document.uri, "default");
                    webviewPanel.dispose();
                    return;
                }
            } catch {
                await vscode.commands.executeCommand("vscode.openWith", document.uri, "default");
                webviewPanel.dispose();
                return;
            }
        }

        const witUri = document.uri.with({ scheme: "wit-extract" });
        const doc = await vscode.workspace.openTextDocument(witUri);
        if (doc.languageId !== "wit") {
            await vscode.languages.setTextDocumentLanguage(doc, "wit");
        }
        await vscode.window.showTextDocument(doc, { preview: false, viewColumn: webviewPanel.viewColumn });
        webviewPanel.dispose();
    }
}

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
    const witExtractProvider = new WitExtractContentProvider();
    const providerDisposable = vscode.workspace.registerTextDocumentContentProvider("wit-extract", witExtractProvider);
    const componentDecoProvider = new ComponentDecorationProvider();
    context.subscriptions.push(vscode.window.registerFileDecorationProvider(componentDecoProvider));
    componentDecoProvider.refresh();

    const wasmWatcher = vscode.workspace.createFileSystemWatcher("**/*.wasm");
    const onCreate = wasmWatcher.onDidCreate((uri) => componentDecoProvider.refresh(uri));
    const onChange = wasmWatcher.onDidChange((uri) => componentDecoProvider.refresh(uri));
    const onDelete = wasmWatcher.onDidDelete((uri) => componentDecoProvider.refresh(uri));
    const onWorkspaceFolders = vscode.workspace.onDidChangeWorkspaceFolders(() => componentDecoProvider.refresh());
    context.subscriptions.push(wasmWatcher, onCreate, onChange, onDelete, onWorkspaceFolders);

    void vscode.commands.executeCommand("setContext", "witIdl.isWasmComponent", false);

    const isWasmComponent = async (filePath: string): Promise<boolean> => isWasmComponentFile(filePath);
    const isWasmPath = (filePath: string | undefined): filePath is string =>
        !!filePath && filePath.toLowerCase().endsWith(".wasm");

    const updateWasmComponentContext = async (uri: vscode.Uri | undefined): Promise<void> => {
        const filePath: string | undefined = uri?.fsPath;
        if (!isWasmPath(filePath)) {
            await vscode.commands.executeCommand("setContext", "witIdl.isWasmComponent", false);
            return;
        }
        const isComp: boolean = await isWasmComponent(filePath);
        await vscode.commands.executeCommand("setContext", "witIdl.isWasmComponent", isComp);
    };

    void updateWasmComponentContext(vscode.window.activeTextEditor?.document.uri);
    const onWindowFocus = vscode.window.onDidChangeWindowState(async (state) => {
        if (state.focused) {
            const editor = vscode.window.activeTextEditor;
            if (editor && isWasmPath(editor.document.uri.fsPath)) {
                await updateWasmComponentContext(editor.document.uri);
            }
        }
    });

    const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (editor && isWasmPath(editor.document.uri.fsPath)) {
            await updateWasmComponentContext(editor.document.uri);
        } else {
            await vscode.commands.executeCommand("setContext", "witIdl.isWasmComponent", false);
        }
    });
    const onWasmOpen = vscode.workspace.onDidOpenTextDocument(async (document) => {
        if (isWasmPath(document.uri.fsPath)) {
            await updateWasmComponentContext(document.uri);
            componentDecoProvider.refresh(document.uri);
        }
    });
    const onWasmSave = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (isWasmPath(document.uri.fsPath)) {
            await updateWasmComponentContext(document.uri);
            componentDecoProvider.refresh(document.uri);
        }
    });

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

    const witFormatter = new WitFormatter();
    const formattingProvider = vscode.languages.registerDocumentFormattingEditProvider("wit", witFormatter);

    const formatDocumentCommand = vscode.commands.registerCommand("wit-idl.formatDocument", async () => {
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor) {
            vscode.window.showWarningMessage("No active editor found");
            return;
        }

        if (activeEditor.document.languageId !== "wit") {
            vscode.window.showWarningMessage("Active file is not a WIT file");
            return;
        }

        try {
            await vscode.commands.executeCommand("editor.action.formatDocument");
        } catch (error) {
            console.error("Failed to format document:", error);
            vscode.window.showErrorMessage(
                `Failed to format document: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    });

    const extractWitCommand = vscode.commands.registerCommand("wit-idl.extractWit", async (resource?: vscode.Uri) => {
        try {
            const targetUri: vscode.Uri | undefined = resource ?? vscode.window.activeTextEditor?.document.uri;
            if (!targetUri) {
                vscode.window.showErrorMessage("No file selected.");
                return;
            }

            const filePath: string = targetUri.fsPath;
            if (!isWasmPath(filePath)) {
                vscode.window.showErrorMessage("Selected file is not a .wasm file.");
                return;
            }

            const isComp: boolean = await isWasmComponent(filePath);
            if (!isComp) {
                vscode.window.showWarningMessage("The selected .wasm is not a WebAssembly component.");
                return;
            }

            const defaultFileName: string = `${path.basename(filePath, ".wasm")}.wit`;
            const defaultDir: string = path.dirname(filePath);
            const saveUri = await vscode.window.showSaveDialog({
                title: "Save extracted WIT",
                defaultUri: vscode.Uri.file(path.join(defaultDir, defaultFileName)),
                filters: { "WIT Files": ["wit"], "All Files": ["*"] },
            });
            if (!saveUri) {
                return;
            }

            let witText: string | undefined;
            try {
                const bytes = fs.readFileSync(filePath);
                witText = await extractWitFromComponent(bytes);
            } catch (err) {
                vscode.window.showErrorMessage(
                    `Failed to extract WIT: ${err instanceof Error ? err.message : String(err)}`
                );
                return;
            }

            fs.writeFileSync(saveUri.fsPath, witText, "utf8");
            vscode.window.showInformationMessage(`WIT extracted to ${saveUri.fsPath}`);
            const doc = await vscode.workspace.openTextDocument(saveUri);
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            console.error("extractWit failed:", error);
            vscode.window.showErrorMessage(
                `Failed to extract WIT: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    });

    const extractCoreWasmCommand = vscode.commands.registerCommand(
        "wit-idl.extractCoreWasm",
        async (resource?: vscode.Uri) => {
            try {
                const targetUri: vscode.Uri | undefined = resource ?? vscode.window.activeTextEditor?.document.uri;
                if (!targetUri) {
                    vscode.window.showErrorMessage("No file selected.");
                    return;
                }

                const filePath: string = targetUri.fsPath;
                if (!filePath.toLowerCase().endsWith(".wasm")) {
                    vscode.window.showErrorMessage("Selected file is not a .wasm file.");
                    return;
                }

                const isComp: boolean = await isWasmComponent(filePath);
                if (!isComp) {
                    vscode.window.showWarningMessage("The selected .wasm is not a WebAssembly component.");
                    return;
                }

                const bytes = await vscode.workspace.fs.readFile(targetUri);
                const fileMap = await extractCoreWasmFromComponent(bytes);
                const entries = Object.entries(fileMap).sort(([a], [b]) =>
                    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
                );
                if (entries.length === 0) {
                    vscode.window.showWarningMessage("No core wasm modules found in this component.");
                    return;
                }

                let [chosenName, chosenContent] = entries[0];
                if (entries.length > 1) {
                    const pick = await vscode.window.showQuickPick(
                        entries.map(([name]) => name),
                        {
                            placeHolder: "Multiple core wasm modules found. Select one to save.",
                        }
                    );
                    if (!pick) {
                        return;
                    }
                    const found = entries.find(([name]) => name === pick);
                    if (found) {
                        [chosenName, chosenContent] = found;
                    }
                }

                const baseName: string = path.basename(filePath, ".wasm");
                const defaultFileName: string = `${baseName}.${chosenName}`; // e.g., mycomp.core0.wasm
                const defaultDir: string = path.dirname(filePath);
                const saveUri = await vscode.window.showSaveDialog({
                    title: "Save extracted Core Wasm",
                    defaultUri: vscode.Uri.file(path.join(defaultDir, defaultFileName)),
                    filters: { WebAssembly: ["wasm"], "All Files": ["*"] },
                });
                if (!saveUri) {
                    return;
                }

                const data = chosenContent; // already Uint8Array
                try {
                    await vscode.workspace.fs.stat(saveUri);
                    const choice = await vscode.window.showWarningMessage(
                        `File already exists: ${saveUri.fsPath}. Overwrite?`,
                        { modal: true },
                        "Overwrite",
                        "Cancel"
                    );
                    if (choice !== "Overwrite") {
                        return;
                    }
                } catch {
                    // ignored: file does not exist
                }
                await vscode.workspace.fs.writeFile(saveUri, data);

                vscode.window.showInformationMessage(`Core wasm extracted to ${saveUri.fsPath}`);
                try {
                    await vscode.commands.executeCommand("vscode.open", saveUri);
                } catch (openError) {
                    vscode.window.showWarningMessage(
                        `Core wasm was extracted and saved to ${saveUri.fsPath}, but could not be opened automatically. You can open it manually (e.g., with "Open With... Hex Editor").`
                    );
                }
            } catch (error) {
                console.error("extractCoreWasm failed:", error);
                vscode.window.showErrorMessage(
                    `Failed to extract core wasm: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );

    const createGenerateBindingsCommand = (language: string, languageLabel: string) => {
        return vscode.commands.registerCommand(
            `wit-idl.generateBindings${languageLabel}`,
            async (resource?: vscode.Uri) => {
                try {
                    const active = vscode.window.activeTextEditor;
                    const targetUri: vscode.Uri | undefined = resource ?? active?.document.uri;
                    if (!targetUri) {
                        vscode.window.showErrorMessage("No file selected. Open a .wit or .wasm component file.");
                        return;
                    }

                    let witContent: string;
                    let diagDoc: vscode.TextDocument | undefined;

                    const isWitDoc =
                        active &&
                        active.document.uri.toString() === targetUri.toString() &&
                        active.document.languageId === "wit";
                    if (isWitDoc) {
                        witContent = active!.document.getText();
                        diagDoc = active!.document;
                        if (!witContent.trim()) {
                            vscode.window.showWarningMessage("The .wit file is empty.");
                            return;
                        }
                    } else if (targetUri.fsPath.toLowerCase().endsWith(".wasm")) {
                        const comp = await isWasmComponentFile(targetUri.fsPath);
                        if (!comp) {
                            vscode.window.showWarningMessage("The selected .wasm is not a WebAssembly component.");
                            return;
                        }
                        const bytes = await vscode.workspace.fs.readFile(targetUri);
                        const extracted = await extractWitFromComponent(bytes);
                        if (!extracted.trim()) {
                            vscode.window.showWarningMessage("No WIT could be extracted from this component.");
                            return;
                        }
                        witContent = extracted;
                        const os = await import("os");
                        const tmpDir = os.tmpdir();
                        const base = path.basename(targetUri.fsPath, ".wasm");
                        const tmpPath = path.join(tmpDir, `wit-idl-${base}-${Date.now()}.wit`);
                        fs.writeFileSync(tmpPath, witContent, "utf8");
                        diagDoc = await vscode.workspace.openTextDocument(tmpPath);
                    } else {
                        vscode.window.showErrorMessage("Unsupported file type. Select a .wit or .wasm component file.");
                        return;
                    }

                    const worldMatch = witContent.match(/world\s+([a-zA-Z][a-zA-Z0-9-_]*)/g);
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

                    const bindingFiles = await generateBindingsFromWasm(witContent, language, selectedWorld);

                    const fileEntries = Object.entries(bindingFiles);
                    const errorFile = fileEntries.find(([filename]) => filename === "error.txt");

                    if (errorFile) {
                        const errorMessage = errorFile[1];
                        const docPath = diagDoc?.uri.fsPath ?? targetUri.fsPath;
                        const parsedError = validator.parseWitBindgenError(errorMessage, docPath);

                        if (parsedError && diagDoc) {
                            const diagnostic = validator.createDiagnosticFromError(parsedError, diagDoc);
                            validator.getDiagnosticCollection().set(diagDoc.uri, [diagnostic]);
                        } else {
                            const cleanMessage = errorMessage.replace(/^\/\/\s*/, "").replace(/\n\/\/\s*/g, "\n");
                            const diagnostic = new vscode.Diagnostic(
                                new vscode.Range(0, 0, 0, 1),
                                `Failed to generate ${languageLabel} bindings: ${cleanMessage}`,
                                vscode.DiagnosticSeverity.Error
                            );
                            diagnostic.source = "wit-bindgen";
                            diagnostic.code = "binding-generation-error";
                            const uriForDiag = diagDoc?.uri ?? targetUri;
                            validator.getDiagnosticCollection().set(uriForDiag, [diagnostic]);
                        }
                        return;
                    }

                    if (fileEntries.length === 0) {
                        const errorMessage =
                            "No files were generated. This may be due to invalid WIT syntax or unsupported features.";
                        const docPath = diagDoc?.uri.fsPath ?? targetUri.fsPath;
                        const parsedError = validator.parseWitBindgenError(errorMessage, docPath);

                        if (parsedError && diagDoc) {
                            const diagnostic = validator.createDiagnosticFromError(parsedError, diagDoc);
                            validator.getDiagnosticCollection().set(diagDoc.uri, [diagnostic]);
                        } else {
                            const diagnostic = new vscode.Diagnostic(
                                new vscode.Range(0, 0, 0, 1),
                                `Failed to generate ${languageLabel} bindings: ${errorMessage}`,
                                vscode.DiagnosticSeverity.Error
                            );
                            diagnostic.source = "wit-bindgen";
                            diagnostic.code = "binding-generation-error";
                            const uriForDiag = diagDoc?.uri ?? targetUri;
                            validator.getDiagnosticCollection().set(uriForDiag, [diagnostic]);
                        }
                        return;
                    }

                    if (diagDoc) {
                        const existingDiagnostics = validator.getDiagnosticCollection().get(diagDoc.uri) || [];
                        const filteredDiagnostics = existingDiagnostics.filter((d) => d.source !== "wit-bindgen");
                        validator.getDiagnosticCollection().set(diagDoc.uri, filteredDiagnostics);
                    }

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
                        `${languageLabel} bindings generated successfully! ${fileCount} file${fileCount > 1 ? "s" : ""} written to ${outputPath}`
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
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const uriForDiag = (vscode.window.activeTextEditor?.document ?? undefined)?.uri;
                    const docPath = uriForDiag?.fsPath ?? "";
                    const parsedError = validator.parseWitBindgenError(errorMessage, docPath);

                    if (parsedError && vscode.window.activeTextEditor) {
                        const diagnostic = validator.createDiagnosticFromError(
                            parsedError,
                            vscode.window.activeTextEditor.document
                        );
                        validator
                            .getDiagnosticCollection()
                            .set(vscode.window.activeTextEditor.document.uri, [diagnostic]);
                    } else {
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(0, 0, 0, 1),
                            `Failed to generate bindings: ${errorMessage}`,
                            vscode.DiagnosticSeverity.Error
                        );
                        diagnostic.source = "wit-bindgen";
                        diagnostic.code = "binding-generation-error";
                        const uriForSet = uriForDiag ?? resource ?? vscode.window.activeTextEditor?.document.uri;
                        if (uriForSet) {
                            validator.getDiagnosticCollection().set(uriForSet, [diagnostic]);
                        }
                    }
                }
            }
        );
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

    // Register custom editor provider to redirect .wasm component files to WIT text view
    const wasmToWitProvider = vscode.window.registerCustomEditorProvider(
        WasmToWitOpenRedirectProvider.viewType,
        new WasmToWitOpenRedirectProvider(),
        {
            supportsMultipleEditorsPerDocument: false,
        }
    );

    context.subscriptions.push(
        providerDisposable,
        witExtractProvider,
        provider,
        formattingProvider,
        syntaxCheckCommand,
        syntaxCheckWorkspaceCommand,
        showVersionCommand,
        formatDocumentCommand,
        extractWitCommand,
        extractCoreWasmCommand,
        generateRustBindingsCommand,
        generateCBindingsCommand,
        generateCSharpBindingsCommand,
        generateGoBindingsCommand,
        generateMoonBitBindingsCommand,
        wasmToWitProvider,
        onSaveListener,
        onOpenListener,
        onCloseListener,
        onActiveEditorChange,
        onWindowFocus,
        onWasmOpen,
        onWasmSave,
        validator.getDiagnosticCollection()
    );
}

export function deactivate() {}
