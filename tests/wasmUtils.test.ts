import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the wit-bindgen-wasm module with the new jco-transpiled API
vi.mock("wit-bindgen-wasm", () => {
    return {
        witValidator: {
            version: vi.fn((): string => "0.42.0-mock"),
            validateWitSyntax: vi.fn((content: string): boolean => {
                return content.includes("package");
            }),
            validateWitSyntaxDetailed: vi.fn((content: string): string => {
                if (content.includes("package")) {
                    return JSON.stringify({ valid: true });
                }
                return JSON.stringify({ valid: false, error: "expected package", errorType: "parsing" });
            }),
            extractInterfaces: vi.fn((): string => "my-interface, another-interface"),
            generateBindings: vi.fn((): string => JSON.stringify({ "lib.rs": "// generated" })),
            extractWitFromComponent: vi.fn().mockReturnValue("package test:component;"),
            extractCoreWasmFromComponent: vi.fn().mockReturnValue(JSON.stringify({ "module-0.wasm": "\x00asm" })),
            hasWorldDefinition: vi.fn((content: string): boolean => content.includes("world")),
            isWitFileExtension: vi.fn((filename: string): boolean => filename.toLowerCase().endsWith(".wit")),
            getWitBindgenVersion: vi.fn((): string => "0.42.0-mock"),
        },
    };
});

import {
    isWitFileExtensionFromWasm,
    validateWitSyntaxFromWasm,
    getWitBindgenVersionFromWasm,
    extractInterfacesFromWasm,
    generateBindingsFromWasm,
    validateWitSyntaxDetailedFromWasm,
    extractWitFromComponent,
    extractCoreWasmFromComponent,
    initializeWasm,
} from "../src/wasmUtils.js";
import { witValidator } from "wit-bindgen-wasm";

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

    describe("validateWitSyntaxFromWasm", () => {
        it("should return true for valid WIT content", async () => {
            const result = await validateWitSyntaxFromWasm("package foo:bar;");
            expect(result).toBe(true);
            expect(witValidator.validateWitSyntax).toHaveBeenCalledWith("package foo:bar;", undefined, undefined);
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
            expect(witValidator.validateWitSyntaxDetailed).toHaveBeenCalledWith(
                "package foo:bar;",
                undefined,
                undefined
            );
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
            expect(witValidator.generateBindings).toHaveBeenCalledWith(
                "package foo:bar; world w {}",
                "rust",
                undefined,
                undefined,
                undefined
            );
        });

        it("should accept optional world name", async () => {
            const result = await generateBindingsFromWasm("package foo:bar; world w {}", "rust", "w");
            expect(result).toBeDefined();
        });
    });

    describe("extractWitFromComponent", () => {
        const dummyBytes = new Uint8Array([0, 97, 115, 109]);
        const mockFn = witValidator.extractWitFromComponent as ReturnType<typeof vi.fn>;

        beforeEach(() => {
            mockFn.mockReturnValue("package test:component;");
        });

        it("should return extracted WIT text on success", async () => {
            const result = await extractWitFromComponent(dummyBytes);
            expect(result).toBe("package test:component;");
            expect(mockFn).toHaveBeenCalledWith(dummyBytes);
        });

        it("should throw when API returns empty string", async () => {
            mockFn.mockReturnValue("");
            await expect(extractWitFromComponent(dummyBytes)).rejects.toThrow("WIT extraction returned no data");
        });

        it("should throw when API returns undefined", async () => {
            mockFn.mockReturnValue(undefined);
            await expect(extractWitFromComponent(dummyBytes)).rejects.toThrow("WIT extraction returned no data");
        });

        it("should throw when API returns null", async () => {
            mockFn.mockReturnValue(null);
            await expect(extractWitFromComponent(dummyBytes)).rejects.toThrow("WIT extraction returned no data");
        });
    });

    describe("extractCoreWasmFromComponent", () => {
        const dummyBytes = new Uint8Array([0, 97, 115, 109]);
        const mockFn = witValidator.extractCoreWasmFromComponent as ReturnType<typeof vi.fn>;

        beforeEach(() => {
            mockFn.mockReturnValue(JSON.stringify({ "module-0.wasm": "\x00asm" }));
        });

        it("should return decoded binary buffers keyed by filename", async () => {
            const result = await extractCoreWasmFromComponent(dummyBytes);
            expect(Object.keys(result)).toEqual(["module-0.wasm"]);
            expect(result["module-0.wasm"]).toBeInstanceOf(Uint8Array);
        });

        it("should correctly decode latin1-encoded content", async () => {
            const latin1Str = "\x00\x01\xFF\xFE";
            mockFn.mockReturnValue(JSON.stringify({ "core.wasm": latin1Str }));
            const result = await extractCoreWasmFromComponent(dummyBytes);
            const buf = result["core.wasm"];
            expect(buf[0]).toBe(0x00);
            expect(buf[1]).toBe(0x01);
            expect(buf[2]).toBe(0xff);
            expect(buf[3]).toBe(0xfe);
        });

        it("should return empty object when no modules found", async () => {
            mockFn.mockReturnValue(JSON.stringify({}));
            const result = await extractCoreWasmFromComponent(dummyBytes);
            expect(result).toEqual({});
        });

        it("should fall back to empty object when API returns null", async () => {
            mockFn.mockReturnValue(null);
            const result = await extractCoreWasmFromComponent(dummyBytes);
            expect(result).toEqual({});
        });

        it("should fall back to empty object when API returns empty string", async () => {
            mockFn.mockReturnValue("");
            const result = await extractCoreWasmFromComponent(dummyBytes);
            expect(result).toEqual({});
        });

        it("should handle multiple modules", async () => {
            mockFn.mockReturnValue(
                JSON.stringify({
                    "module-0.wasm": "abc",
                    "module-1.wasm": "def",
                })
            );
            const result = await extractCoreWasmFromComponent(dummyBytes);
            expect(Object.keys(result)).toHaveLength(2);
            expect(result["module-0.wasm"]).toBeInstanceOf(Uint8Array);
            expect(result["module-1.wasm"]).toBeInstanceOf(Uint8Array);
        });

        it("should throw on invalid JSON", async () => {
            mockFn.mockReturnValue("not json at all");
            await expect(extractCoreWasmFromComponent(dummyBytes)).rejects.toThrow();
        });
    });
});
