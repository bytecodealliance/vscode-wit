import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as vscode from "vscode";
import { WitSyntaxValidator } from "../src/witValidator.js";

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
}));

// Mock the @bytecodealliance/jco types function
vi.mock("@bytecodealliance/jco", () => ({
    types: vi.fn(),
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
            const { types } = await import("@bytecodealliance/jco");
            vi.mocked(types).mockResolvedValueOnce({} as any);

            const result = await validator.validate("/test/file.wit", "valid content");
            expect(result).toBeNull();
        });

        it("should return error info for invalid WIT files", async () => {
            const { types } = await import("@bytecodealliance/jco");
            const mockError = new Error("Test error");
            mockError.stack = `Error: reading WIT file at [/test/file.wit]

Caused by:
    expected '{', found keyword \`interface\`
         --> /test/file.wit:3:1
          |
        3 | interface test {
          | ^`;

            vi.mocked(types).mockRejectedValueOnce(mockError);

            const result = await validator.validate("/test/file.wit", "invalid content");

            expect(result).not.toBeNull();
            expect(result?.mainError).toBe("reading WIT file at [/test/file.wit]");
            expect(result?.detailedError).toBe("expected '{', found keyword `interface`");
            expect(result?.filePath).toBe("/test/file.wit");
            expect(result?.row).toBe(3);
            expect(result?.column).toBe(1);
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
