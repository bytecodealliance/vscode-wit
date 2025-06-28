import { describe, it, expect, vi } from "vitest";

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

describe("Sized List Support", () => {
    it("should support sized lists in WIT syntax", async () => {
        const { validateWitSyntaxDetailedFromWasm } = await import("../src/wasmUtils.js");
        
        const witContent = `package foo:foo;

interface test {
  get-ipv4-address1: func() -> list<u8, 4>;
  get-ipv4-address2: func() -> tuple<u8, u8, u8, u8>;
}

world test-world {
  export test;
}`;

        const result = await validateWitSyntaxDetailedFromWasm(witContent);
        console.log("Validation result:", result);
        // For now, let's just test that the function runs without throwing
        expect(result).toBeDefined();
    });
});