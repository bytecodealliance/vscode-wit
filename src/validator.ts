import * as vscode from "vscode";
import { validateWitSyntaxDetailedFromWasm, type WitValidationResult } from "./wasmUtils.js";
import { extractErrorInfo } from "./errorParser.js";

export { extractErrorInfo };

/**
 * WIT Syntax Validator using WASM-based wit-parser
 *
 * This validator uses the enhanced WASM-based wit-parser implementation
 * that follows wit-parser best practices for accurate WIT syntax validation.
 * It provides both single-file and workspace-wide validation capabilities.
 */
export class WitSyntaxValidator {
    private readonly diagnosticCollection = vscode.languages.createDiagnosticCollection("wit");

    workspaceCheck: boolean = false;

    public getDiagnosticCollection(): vscode.DiagnosticCollection {
        return this.diagnosticCollection;
    }

    /**
     * Validate a WIT file and return error information
     *
     * Uses the WASM-based wit-parser for accurate validation following
     * wit-parser best practices. Returns null if validation succeeds,
     * or error information if validation fails.
     *
     * @param path - File path (used for error reporting)
     * @param content - File content to validate
     * @returns Error information if validation fails, null if validation succeeds
     */
    public async validate(path: string, content: string): Promise<ReturnType<typeof extractErrorInfo> | null> {
        try {
            // Use the enhanced WASM-based WIT validation with detailed error reporting
            const validationResult = await validateWitSyntaxDetailedFromWasm(content);

            if (validationResult.valid) {
                return null;
            } else {
                const errorMessage = validationResult.error || "Unknown WIT validation error";

                const errorInfo = this.parseWitParserError(errorMessage, path);
                if (errorInfo) {
                    return errorInfo;
                }

                return {
                    mainError: "WIT syntax validation failed",
                    detailedError: errorMessage,
                    filePath: path,
                    row: 1,
                    column: 1,
                };
            }
        } catch (error: unknown) {
            if (error && typeof error === "object" && "stack" in error) {
                const errorInfo = extractErrorInfo(error.stack as string);
                if (errorInfo !== null) {
                    return errorInfo;
                }
            }

            return {
                mainError: "WIT validation error",
                detailedError: error instanceof Error ? error.message : String(error),
                filePath: path,
                row: 1,
                column: 1,
            };
        }
    }

    /**
     * Perform syntax check on the current active WIT file
     * @param editor - The active text editor
     */
    public async syntaxCheckCurrentFile(editor: vscode.TextEditor): Promise<void> {
        const document = editor.document;
        const content = document.getText();

        try {
            this.clearDiagnostics(document.uri);

            const errorInfo = await this.validate(document.uri.fsPath, content);

            if (errorInfo) {
                const diagnostic = this.createDiagnosticFromError(errorInfo, document);

                this.diagnosticCollection.set(document.uri, [diagnostic]);
            } else {
                // File is valid - errors are cleared and reported in problems pane
            }
        } catch (error) {
            console.error("Error during WIT validation:", error);
            // Log error to console, diagnostics are already in problems pane
        }
    }

    /**
     * Create a VS Code diagnostic from WIT error information
     * @param errorInfo - The parsed error information
     * @param document - The text document
     * @returns A VS Code diagnostic
     */
    public createDiagnosticFromError(
        errorInfo: NonNullable<ReturnType<typeof extractErrorInfo>>,
        document: vscode.TextDocument
    ): vscode.Diagnostic {
        const line = Math.max(0, (errorInfo.row || 1) - 1);
        const character = Math.max(0, (errorInfo.column || 1) - 1);

        const documentLine = document.lineAt(Math.min(line, document.lineCount - 1));
        const endCharacter = Math.min(character + 10, documentLine.text.length);

        const range = new vscode.Range(new vscode.Position(line, character), new vscode.Position(line, endCharacter));

        const message = errorInfo.detailedError || errorInfo.mainError || "Unknown WIT syntax error";

        const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);

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
     */
    public async syntaxCheckWorkspace(): Promise<void> {
        const witFiles = await vscode.workspace.findFiles("**/*.wit", "**/node_modules/**");

        if (witFiles.length === 0) {
            console.log("No WIT files found in workspace");
            return;
        }

        this.clearAllDiagnostics();

        let totalErrors = 0;
        let totalFiles = 0;
        const validFiles: string[] = [];
        const errorFiles: string[] = [];

        try {
            this.workspaceCheck = true;
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
                            const errorInfo = await this.validate(document.uri.fsPath, content);

                            totalFiles++;

                            if (errorInfo) {
                                // Create and set diagnostic
                                const diagnostic = this.createDiagnosticFromError(errorInfo, document);
                                this.diagnosticCollection.set(document.uri, [diagnostic]);

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
        } finally {
            this.workspaceCheck = false;
        }

        const validCount = totalFiles - totalErrors;
        const message = `WIT Syntax Check Complete: ${validCount}/${totalFiles} files valid, ${totalErrors} error(s)`;

        if (totalErrors > 0) {
            // Don't show dialog, but create output channel for detailed results

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
            // All files valid - results are shown in problems pane
            console.log(message);
        }
    }

    public clearDiagnostics(uri: vscode.Uri): void {
        if (!this.workspaceCheck) {
            this.diagnosticCollection.delete(uri);
        }
    }

    public clearAllDiagnostics(): void {
        this.diagnosticCollection.clear();
    }

    public dispose(): void {
        this.diagnosticCollection.dispose();
    }

    /**
     * Parse wit-parser error messages to extract location information
     * @param errorMessage - The error message from wit-parser
     * @param filePath - The file path for the error
     * @returns Parsed error information or null if parsing fails
     */
    private parseWitParserError(errorMessage: string, filePath: string): ReturnType<typeof extractErrorInfo> | null {
        // Handle undefined type errors specifically
        const undefinedTypeMatch = errorMessage.match(/undefined type `([^`]+)`/);
        if (undefinedTypeMatch) {
            const typeName = undefinedTypeMatch[1];
            const locationMatch = errorMessage.match(/-->\s*(.+?):\s*(\d+):\s*(\d+)/);
            const row = locationMatch ? parseInt(locationMatch[2], 10) : 1;
            const column = locationMatch ? parseInt(locationMatch[3], 10) : 1;

            return {
                mainError: "Undefined type error",
                detailedError: `Undefined type '${typeName}' - check if the type is defined or imported correctly`,
                filePath,
                row,
                column,
            };
        }

        const locationMatch = errorMessage.match(/-->\s*(.+?):\s*(\d+):\s*(\d+)/);
        if (locationMatch) {
            const row = parseInt(locationMatch[2], 10);
            const column = parseInt(locationMatch[3], 10);

            const mainError = errorMessage.split("\n")[0]?.trim() || "Unknown error";

            return {
                mainError: "WIT parser error",
                detailedError: mainError,
                filePath,
                row,
                column,
            };
        }

        const fallbackError = extractErrorInfo(errorMessage);
        return fallbackError || null;
    }

    /**
     * Parse wit-bindgen error messages to extract location information
     * @param errorMessage - The error message from wit-bindgen
     * @param filePath - The file path for the error
     * @returns Parsed error information or null if parsing fails
     */
    public parseWitBindgenError(errorMessage: string, filePath: string): ReturnType<typeof extractErrorInfo> | null {
        // Remove comment markers from the error message
        const cleanMessage = errorMessage
            .replace(/^\/\/\s*/, "")
            .replace(/\n\/\/\s*/g, "\n")
            .trim();

        // Try to extract location information similar to wit-parser errors
        const locationMatch = cleanMessage.match(/-->\s*(.*?):(\d+):(\d+)/);
        if (locationMatch) {
            const row = parseInt(locationMatch[2], 10);
            const column = parseInt(locationMatch[3], 10);

            const lines = cleanMessage.split("\n");
            const mainError = lines[0] || cleanMessage;

            return {
                mainError: "WIT binding generation error",
                detailedError: mainError.trim(),
                filePath,
                row,
                column,
            };
        }

        // Check for specific wit-bindgen error patterns
        if (cleanMessage.includes("undefined type")) {
            const typeMatch = cleanMessage.match(/undefined type `([^`]+)`/);
            const typeName = typeMatch ? typeMatch[1] : "unknown";

            return {
                mainError: "Undefined type in bindings",
                detailedError: `Undefined type '${typeName}' - ensure type is properly defined in WIT file`,
                filePath,
                row: 1,
                column: 1,
            };
        }

        if (cleanMessage.includes("failed to resolve")) {
            return {
                mainError: "Binding resolution error",
                detailedError: cleanMessage,
                filePath,
                row: 1,
                column: 1,
            };
        }

        if (cleanMessage.includes("expected") && cleanMessage.includes("found")) {
            return {
                mainError: "Binding syntax error",
                detailedError: cleanMessage,
                filePath,
                row: 1,
                column: 1,
            };
        }

        if (cleanMessage.includes("unsupported")) {
            return {
                mainError: "Unsupported feature",
                detailedError: cleanMessage,
                filePath,
                row: 1,
                column: 1,
            };
        }

        // Return parsed info for any other error
        return {
            mainError: "Binding generation failed",
            detailedError: cleanMessage,
            filePath,
            row: 1,
            column: 1,
        };
    }
}
