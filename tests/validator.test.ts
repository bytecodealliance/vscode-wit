import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as vscode from "vscode";
import { WitSyntaxValidator } from "../src/validator.js";

// Mock VS Code API
vi.mock("vscode", () => ({
    languages: {
        createDiagnosticCollection: vi.fn(() => ({
            delete: vi.fn(),
            clear: vi.fn(),
            set: vi.fn(),
            dispose: vi.fn(),
        })),
    },
    DiagnosticCollection: vi.fn(),
    extensions: {
        getExtension: vi.fn(() => ({
            extensionPath: "/mock/extension/path",
        })),
    },
}));

// Mock the WASM utilities
vi.mock("../src/wasmUtils.js", () => ({
    validateWitSyntaxDetailedFromWasm: vi.fn(),
}));

describe("WitSyntaxValidator", () => {
    let validator: WitSyntaxValidator;

    beforeEach(() => {
        validator = new WitSyntaxValidator();
    });

    afterEach(() => {
        validator.dispose();
    });

    describe("getDiagnosticCollection", () => {
        it("should return a diagnostic collection", () => {
            const collection = validator.getDiagnosticCollection();
            expect(collection).toBeDefined();
        });
    });

    describe("validate", () => {
        it("should return null for valid WIT files", async () => {
            const { validateWitSyntaxDetailedFromWasm } = await import("../src/wasmUtils.js");
            vi.mocked(validateWitSyntaxDetailedFromWasm).mockResolvedValueOnce({ valid: true });

            const result = await validator.validate("/test/file.wit", "valid content");
            expect(result).toBeNull();
        });

        it("should return error info for invalid WIT files", async () => {
            const { validateWitSyntaxDetailedFromWasm } = await import("../src/wasmUtils.js");
            vi.mocked(validateWitSyntaxDetailedFromWasm).mockResolvedValueOnce({
                valid: false,
                error: "undefined type `type4`",
                errorType: "resolution",
            });

            const result = await validator.validate("/test/file.wit", "invalid content");

            expect(result).not.toBeNull();
            expect(result?.mainError).toBe("Undefined type error");
            expect(result?.detailedError).toBe(
                "Undefined type 'type4' - check if the type is defined or imported correctly"
            );
            expect(result?.filePath).toBe("/test/file.wit");
            expect(result?.row).toBe(1);
            expect(result?.column).toBe(1);
        });

        it("should handle WASM validation errors", async () => {
            const { validateWitSyntaxDetailedFromWasm } = await import("../src/wasmUtils.js");
            const mockError = new Error("WASM validation error");
            mockError.stack = `Error: reading WIT file at [/test/file.wit]

Caused by:
    expected '{', found keyword \`interface\`
         --> /test/file.wit:3:1
          |
        3 | interface test {
          | ^`;

            vi.mocked(validateWitSyntaxDetailedFromWasm).mockRejectedValueOnce(mockError);

            const result = await validator.validate("/test/file.wit", "invalid content");

            expect(result).not.toBeNull();
            expect(result?.mainError).toBe("reading WIT file at [/test/file.wit]");
            expect(result?.detailedError).toBe("expected '{', found keyword `interface`");
            expect(result?.filePath).toBe("/test/file.wit");
            expect(result?.row).toBe(3);
            expect(result?.column).toBe(1);
        });

        it("should detect undefined types in WIT files", async () => {
            const { validateWitSyntaxDetailedFromWasm } = await import("../src/wasmUtils.js");
            // Simulate the WASM validator returning false for invalid content with undefined types
            vi.mocked(validateWitSyntaxDetailedFromWasm).mockResolvedValueOnce({
                valid: false,
                error: "undefined type `type4`",
                errorType: "resolution",
            });

            const invalidWitContent = `package foo:foo;

interface i {
  type type1 = u32;
}

world foo {
  use i.{type1};

  type type2 = u32;

  record type3 {
    r: u32,
  }

  export foo: func() -> tuple<type1, type2, type3, type4>;
}`;

            const result = await validator.validate("/test/worlds-with-types.wit", invalidWitContent);

            expect(result).not.toBeNull();
            expect(result?.mainError).toBe("Undefined type error");
            expect(result?.detailedError).toBe(
                "Undefined type 'type4' - check if the type is defined or imported correctly"
            );
            expect(result?.filePath).toBe("/test/worlds-with-types.wit");
        });
    });

    describe("clearDiagnostics", () => {
        it("should call delete on diagnostic collection", () => {
            const mockUri = {} as vscode.Uri;
            const collection = validator.getDiagnosticCollection();

            validator.clearDiagnostics(mockUri);

            expect(collection.delete).toHaveBeenCalledWith(mockUri);
        });
    });

    describe("clearAllDiagnostics", () => {
        it("should call clear on diagnostic collection", () => {
            const collection = validator.getDiagnosticCollection();

            validator.clearAllDiagnostics();

            expect(collection.clear).toHaveBeenCalled();
        });
    });
});
