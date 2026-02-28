import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock VS Code API
vi.mock("vscode", () => {
    class MockPosition {
        constructor(
            public line: number,
            public character: number
        ) {}
    }
    class MockRange {
        constructor(
            public start: MockPosition,
            public end: MockPosition
        ) {}
    }
    class MockLocation {
        constructor(
            public uri: unknown,
            public range: unknown
        ) {}
    }
    class MockDiagnostic {
        source: string | undefined;
        code: string | undefined;
        relatedInformation: unknown[] | undefined;
        constructor(
            public range: unknown,
            public message: string,
            public severity: number
        ) {}
    }
    class MockDiagnosticRelatedInformation {
        constructor(
            public location: unknown,
            public message: string
        ) {}
    }
    return {
        languages: {
            createDiagnosticCollection: vi.fn(() => ({
                delete: vi.fn(),
                clear: vi.fn(),
                set: vi.fn(),
                dispose: vi.fn(),
                get: vi.fn(() => []),
            })),
        },
        DiagnosticCollection: vi.fn(),
        DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
        Diagnostic: MockDiagnostic,
        Range: MockRange,
        Position: MockPosition,
        Location: MockLocation,
        DiagnosticRelatedInformation: MockDiagnosticRelatedInformation,
        extensions: {
            getExtension: vi.fn(() => ({
                extensionPath: "/mock/extension/path",
            })),
        },
    };
});

// Mock the WASM utilities
vi.mock("../src/wasmUtils.js", () => ({
    validateWitSyntaxDetailedFromWasm: vi.fn(),
}));

import { WitSyntaxValidator } from "../src/validator.js";

describe("WitSyntaxValidator — parseWitBindgenError", () => {
    let validator: WitSyntaxValidator;

    beforeEach(() => {
        validator = new WitSyntaxValidator();
    });

    afterEach(() => {
        validator.dispose();
    });

    describe("parseWitBindgenError", () => {
        it("should parse error with location information", () => {
            const errorMessage = `// failed to parse WIT
// 
// Caused by:
//     expected '{', found keyword \`interface\`
//          --> /test/file.wit:3:1
//           |
//         3 | interface test {
//           | ^`;

            const result = validator.parseWitBindgenError(errorMessage, "/test/file.wit");
            expect(result).not.toBeNull();
            expect(result!.mainError).toBe("WIT binding generation error");
            expect(result!.row).toBe(3);
            expect(result!.column).toBe(1);
        });

        it("should parse undefined type errors", () => {
            const errorMessage = "// undefined type `MyType` in generated bindings";

            const result = validator.parseWitBindgenError(errorMessage, "/test/file.wit");
            expect(result).not.toBeNull();
            expect(result!.mainError).toBe("Undefined type in bindings");
            expect(result!.detailedError).toContain("MyType");
        });

        it("should parse failed to resolve errors", () => {
            const errorMessage = "failed to resolve interface 'my-interface'";

            const result = validator.parseWitBindgenError(errorMessage, "/test/file.wit");
            expect(result).not.toBeNull();
            expect(result!.mainError).toBe("Binding resolution error");
            expect(result!.detailedError).toContain("failed to resolve");
        });

        it("should parse expected/found syntax errors", () => {
            const errorMessage = "expected '{' found '}'";

            const result = validator.parseWitBindgenError(errorMessage, "/test/file.wit");
            expect(result).not.toBeNull();
            expect(result!.mainError).toBe("Binding syntax error");
        });

        it("should parse unsupported feature errors", () => {
            const errorMessage = "unsupported feature: async functions";

            const result = validator.parseWitBindgenError(errorMessage, "/test/file.wit");
            expect(result).not.toBeNull();
            expect(result!.mainError).toBe("Unsupported feature");
        });

        it("should handle generic errors as fallback", () => {
            const errorMessage = "something went wrong with binding generation";

            const result = validator.parseWitBindgenError(errorMessage, "/test/file.wit");
            expect(result).not.toBeNull();
            expect(result!.mainError).toBe("Binding generation failed");
            expect(result!.detailedError).toBe("something went wrong with binding generation");
            expect(result!.filePath).toBe("/test/file.wit");
            expect(result!.row).toBe(1);
            expect(result!.column).toBe(1);
        });

        it("should strip comment markers from error messages", () => {
            const errorMessage = "// Error in binding\n// generation process";

            const result = validator.parseWitBindgenError(errorMessage, "/test/file.wit");
            expect(result).not.toBeNull();
            expect(result!.detailedError).not.toContain("//");
        });

        it("should handle empty error message", () => {
            const result = validator.parseWitBindgenError("", "/test/file.wit");
            expect(result).not.toBeNull();
            expect(result!.mainError).toBe("Binding generation failed");
        });
    });

    describe("createDiagnosticFromError", () => {
        it("should create a diagnostic with correct range", () => {
            const errorInfo = {
                mainError: "Test error",
                detailedError: "Detailed test error",
                filePath: "/test/file.wit",
                row: 5,
                column: 10,
            };

            const mockDocument = {
                lineAt: vi.fn(() => ({ text: "some wit content here" })),
                lineCount: 100,
                uri: { fsPath: "/test/file.wit" },
            } as unknown as import("vscode").TextDocument;

            const diagnostic = validator.createDiagnosticFromError(errorInfo, mockDocument);

            expect(diagnostic).toBeDefined();
            expect(diagnostic.message).toBe("Detailed test error");
            expect(diagnostic.source).toBe("wit-syntax");
            expect(diagnostic.code).toBe("wit-parse-error");
        });

        it("should use mainError as message when detailedError is absent", () => {
            const errorInfo = {
                mainError: "Main error only",
                filePath: "/test/file.wit",
                row: 1,
                column: 1,
            };

            const mockDocument = {
                lineAt: vi.fn(() => ({ text: "content" })),
                lineCount: 10,
                uri: { fsPath: "/test/file.wit" },
            } as unknown as import("vscode").TextDocument;

            const diagnostic = validator.createDiagnosticFromError(errorInfo, mockDocument);
            expect(diagnostic.message).toBe("Main error only");
        });

        it("should add related information when both mainError and detailedError exist", () => {
            const errorInfo = {
                mainError: "Context info",
                detailedError: "The detailed message",
                filePath: "/test/file.wit",
                row: 2,
                column: 3,
            };

            const mockDocument = {
                lineAt: vi.fn(() => ({ text: "a line of wit" })),
                lineCount: 50,
                uri: { fsPath: "/test/file.wit" },
            } as unknown as import("vscode").TextDocument;

            const diagnostic = validator.createDiagnosticFromError(errorInfo, mockDocument);
            expect(diagnostic.relatedInformation).toBeDefined();
            expect(diagnostic.relatedInformation).toHaveLength(1);
        });

        it("should clamp row and column to valid range", () => {
            const errorInfo = {
                mainError: "Error",
                detailedError: "Details",
                filePath: "/test/file.wit",
                row: 0, // below 1
                column: 0, // below 1
            };

            const mockDocument = {
                lineAt: vi.fn(() => ({ text: "content" })),
                lineCount: 5,
                uri: { fsPath: "/test/file.wit" },
            } as unknown as import("vscode").TextDocument;

            const diagnostic = validator.createDiagnosticFromError(errorInfo, mockDocument);
            // Should not throw even with row/column 0
            expect(diagnostic).toBeDefined();
        });

        it("should handle row exceeding document line count", () => {
            const errorInfo = {
                mainError: "Error",
                detailedError: "Details",
                filePath: "/test/file.wit",
                row: 999,
                column: 1,
            };

            const mockDocument = {
                lineAt: vi.fn(() => ({ text: "last line" })),
                lineCount: 5,
                uri: { fsPath: "/test/file.wit" },
            } as unknown as import("vscode").TextDocument;

            const diagnostic = validator.createDiagnosticFromError(errorInfo, mockDocument);
            expect(diagnostic).toBeDefined();
            // lineAt should be called with clamped value
            expect(mockDocument.lineAt).toHaveBeenCalledWith(4); // min(998, 4)
        });
    });

    describe("validate — parseWitParserError paths", () => {
        it("should parse wit-parser error with location info", async () => {
            const { validateWitSyntaxDetailedFromWasm } = await import("../src/wasmUtils.js");
            vi.mocked(validateWitSyntaxDetailedFromWasm).mockResolvedValueOnce({
                valid: false,
                error: "expected '}'\n  --> /test/file.wit:10:5\n   |\n10 | bad syntax",
                errorType: "parsing",
            });

            const result = await validator.validate("/test/file.wit", "bad content");
            expect(result).not.toBeNull();
            expect(result!.row).toBe(10);
            expect(result!.column).toBe(5);
        });

        it("should handle validation result with no error message", async () => {
            const { validateWitSyntaxDetailedFromWasm } = await import("../src/wasmUtils.js");
            vi.mocked(validateWitSyntaxDetailedFromWasm).mockResolvedValueOnce({
                valid: false,
                error: undefined,
                errorType: undefined,
            });

            const result = await validator.validate("/test/file.wit", "bad content");
            expect(result).not.toBeNull();
            expect(result!.mainError).toBe("WIT syntax validation failed");
        });

        it("should handle thrown error without stack", async () => {
            const { validateWitSyntaxDetailedFromWasm } = await import("../src/wasmUtils.js");
            vi.mocked(validateWitSyntaxDetailedFromWasm).mockRejectedValueOnce("string error");

            const result = await validator.validate("/test/file.wit", "bad content");
            expect(result).not.toBeNull();
            expect(result!.mainError).toBe("WIT validation error");
            expect(result!.detailedError).toBe("string error");
        });
    });

    describe("workspaceCheck flag", () => {
        it("should prevent clearing diagnostics during workspace check", () => {
            const collection = validator.getDiagnosticCollection();
            const mockUri = {} as import("vscode").Uri;

            validator.workspaceCheck = true;
            validator.clearDiagnostics(mockUri);
            expect(collection.delete).not.toHaveBeenCalled();

            validator.workspaceCheck = false;
            validator.clearDiagnostics(mockUri);
            expect(collection.delete).toHaveBeenCalledWith(mockUri);
        });
    });
});
