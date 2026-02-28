import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock vscode before importing wasmUtils
vi.mock("vscode", () => ({
    extensions: {
        getExtension: vi.fn(() => ({
            extensionUri: { fsPath: "/mock/extension" },
        })),
    },
    workspace: {
        fs: {
            stat: vi.fn(),
            readFile: vi.fn(),
        },
    },
    Uri: {
        joinPath: vi.fn((_base: unknown, ...segments: string[]) => ({
            fsPath: `/mock/extension/${segments.join("/")}`,
        })),
    },
}));

// Mock the wit-bindgen-wasm module
vi.mock("wit-bindgen-wasm", () => {
    class MockWitBindgen {
        version(): string {
            return "0.42.0-mock";
        }
        validateWitSyntax(content: string): boolean {
            return content.includes("package");
        }
        validateWitSyntaxDetailed(content: string): string {
            if (content.includes("package")) {
                return JSON.stringify({ valid: true });
            }
            return JSON.stringify({ valid: false, error: "expected package", errorType: "parsing" });
        }
        extractInterfaces(): string {
            return "my-interface, another-interface";
        }
        generateBindings(): string {
            return JSON.stringify({ "lib.rs": "// generated" });
        }
        free(): void {}
    }
    return {
        default: vi.fn(),
        WitBindgen: MockWitBindgen,
    };
});

import {
    isWitFileExtensionFromWasm,
    validateWitSyntaxFromWasm,
    getWitBindgenVersionFromWasm,
    createWitBindgenInstance,
    extractInterfacesFromWasm,
    generateBindingsFromWasm,
    validateWitSyntaxDetailedFromWasm,
    initializeWasm,
} from "../src/wasmUtils.js";

describe("wasmUtils", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("isWitFileExtensionFromWasm", () => {
        it("should return true for .wit files", async () => {
            expect(await isWitFileExtensionFromWasm("test.wit")).toBe(true);
        });

        it("should return true for .WIT files (case-insensitive)", async () => {
            expect(await isWitFileExtensionFromWasm("test.WIT")).toBe(true);
        });

        it("should return false for non-.wit files", async () => {
            expect(await isWitFileExtensionFromWasm("test.rs")).toBe(false);
        });

        it("should return false for files ending with .wits", async () => {
            expect(await isWitFileExtensionFromWasm("test.wits")).toBe(false);
        });

        it("should return false for empty string", async () => {
            expect(await isWitFileExtensionFromWasm("")).toBe(false);
        });

        it("should return true for paths with directories", async () => {
            expect(await isWitFileExtensionFromWasm("/path/to/file.wit")).toBe(true);
        });
    });

    describe("initializeWasm", () => {
        it("should initialize the WASM module", async () => {
            await expect(initializeWasm()).resolves.toBeUndefined();
        });

        it("should not re-initialize if already initialized", async () => {
            await initializeWasm();
            await initializeWasm();
            // Should not throw on double init
        });
    });

    describe("getWitBindgenVersionFromWasm", () => {
        it("should return a version string", async () => {
            const version = await getWitBindgenVersionFromWasm();
            expect(typeof version).toBe("string");
            expect(version).toBe("0.42.0-mock");
        });
    });

    describe("createWitBindgenInstance", () => {
        it("should return a WitBindgen instance", async () => {
            const instance = await createWitBindgenInstance();
            expect(instance).toBeDefined();
            expect(typeof instance.version).toBe("function");
        });
    });

    describe("validateWitSyntaxFromWasm", () => {
        it("should return true for valid WIT content", async () => {
            const result = await validateWitSyntaxFromWasm("package foo:bar;");
            expect(result).toBe(true);
        });

        it("should return false for invalid WIT content", async () => {
            const result = await validateWitSyntaxFromWasm("not valid wit");
            expect(result).toBe(false);
        });
    });

    describe("validateWitSyntaxDetailedFromWasm", () => {
        it("should return valid result for valid content", async () => {
            const result = await validateWitSyntaxDetailedFromWasm("package foo:bar;");
            expect(result.valid).toBe(true);
        });

        it("should return error details for invalid content", async () => {
            const result = await validateWitSyntaxDetailedFromWasm("not valid wit");
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.errorType).toBe("parsing");
        });
    });

    describe("extractInterfacesFromWasm", () => {
        it("should return comma-separated interface names", async () => {
            const result = await extractInterfacesFromWasm("package foo:bar; interface my-interface {}");
            expect(result).toBe("my-interface, another-interface");
        });
    });

    describe("generateBindingsFromWasm", () => {
        it("should return a map of generated files", async () => {
            const result = await generateBindingsFromWasm("package foo:bar; world w {}", "rust");
            expect(result).toBeDefined();
            expect(typeof result).toBe("object");
            expect(result["lib.rs"]).toBe("// generated");
        });

        it("should accept optional world name", async () => {
            const result = await generateBindingsFromWasm("package foo:bar; world w {}", "rust", "w");
            expect(result).toBeDefined();
        });
    });
});
