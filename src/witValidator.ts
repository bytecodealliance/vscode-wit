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
     * Clear all diagnostics for a specific file
     * @param uri - File URI
     */
    public clearDiagnostics(uri: vscode.Uri): void {
        this.diagnosticCollection.delete(uri);
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
