import * as vscode from "vscode";
import { types } from "@bytecodealliance/jco";
import { extractErrorInfo } from "./errorParser.js";

export { extractErrorInfo };

// Example usage with the sample stack:
// const errorInfo = extractErrorInfo(sampleStack);
// Result would be:
// {
//     mainError: "reading WIT file at [/home/gordon/vscode-wit/tests/grammar/integration/floats.wit]",
//     detailedError: "expected '{', found keyword `interface`",
//     filePath: "/home/gordon/vscode-wit/tests/grammar/integration/floats.wit",
//     row: 3,
//     column: 1
// }

export class WitSyntaxValidator {
    private readonly diagnosticCollection = vscode.languages.createDiagnosticCollection("wit");

    workspaceCheck: boolean = false;

    /**
     * Get the diagnostic collection for managing error display
     */
    public getDiagnosticCollection(): vscode.DiagnosticCollection {
        return this.diagnosticCollection;
    }

    /**
     * Validate a WIT file and return error information
     * @param path - File path
     * @param content - File content
     * @returns Error information if validation fails, null if validation succeeds
     */
    public async validate(path: string, content: string): Promise<ReturnType<typeof extractErrorInfo> | null> {
        try {
            await types(path, {});
            return null; // Validation succeeded
        } catch (error: unknown) {
            if (error && typeof error === "object" && "stack" in error) {
                const errorInfo = extractErrorInfo(error.stack as string);
                if (errorInfo === null) {
                    throw new Error("Failed to parse error stack trace. Validation failed.");
                }
                return errorInfo;
            }
        }
        return null;
    }

    /**
     * Perform syntax check on the current active WIT file
     * @param editor - The active text editor
     */
    public async syntaxCheckCurrentFile(editor: vscode.TextEditor): Promise<void> {
        const document = editor.document;
        const content = document.getText();

        try {
            // Clear existing diagnostics for this file
            this.clearDiagnostics(document.uri);

            // Validate the file
            const errorInfo = await this.validate(document.uri.fsPath, content);

            if (errorInfo) {
                // Create a diagnostic from the error information
                const diagnostic = this.createDiagnosticFromError(errorInfo, document);

                // Set the diagnostic for this file
                this.diagnosticCollection.set(document.uri, [diagnostic]);

                // Show error message
                vscode.window.showErrorMessage(
                    `WIT Syntax Error in ${vscode.workspace.asRelativePath(document.uri)}: ${errorInfo.mainError}`
                );
            } else {
                // Validation succeeded - show success message
                vscode.window.showInformationMessage(
                    `WIT file ${vscode.workspace.asRelativePath(document.uri)} is valid`
                );
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
    private createDiagnosticFromError(
        errorInfo: NonNullable<ReturnType<typeof extractErrorInfo>>,
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
     */
    public async syntaxCheckWorkspace(): Promise<void> {
        const witFiles = await vscode.workspace.findFiles("**/*.wit", "**/node_modules/**");

        if (witFiles.length === 0) {
            vscode.window.showInformationMessage("No WIT files found in workspace");
            return;
        }

        // Clear all existing diagnostics
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

    /**
     * Clear all diagnostics for a specific file
     * @param uri - File URI
     */
    public clearDiagnostics(uri: vscode.Uri): void {
        if (!this.workspaceCheck) {
            this.diagnosticCollection.delete(uri);
        }
    }

    /**
     * Clear all diagnostics
     */
    public clearAllDiagnostics(): void {
        this.diagnosticCollection.clear();
    }

    /**
     * Dispose of the diagnostic collection
     */
    public dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
