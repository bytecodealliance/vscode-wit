import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { canUseWitPathGeneration, isExtractedWitFromWasm, type UriLike } from "../src/bindingsSource.js";

describe("canUseWitPathGeneration", () => {
    it("returns true for existing file-backed .wit paths", () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wit-idl-source-test-"));
        const witPath = path.join(tempDir, "world.wit");
        fs.writeFileSync(witPath, "package example:test; world w {}", "utf8");

        try {
            const uri: UriLike = { scheme: "file", fsPath: witPath };
            expect(canUseWitPathGeneration(uri)).toBe(true);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it("returns false for virtual extracted WIT views", () => {
        const uri: UriLike = { scheme: "wit-extract", fsPath: "/tmp/component.wasm" };
        expect(canUseWitPathGeneration(uri)).toBe(false);
    });

    it("returns false for wit-extract even with a valid .wit fsPath", () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wit-idl-source-test-"));
        const witPath = path.join(tempDir, "world.wit");
        fs.writeFileSync(witPath, "package example:test; world w {}", "utf8");

        try {
            const uri: UriLike = { scheme: "wit-extract", fsPath: witPath };
            expect(canUseWitPathGeneration(uri)).toBe(false);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it("returns true for existing .wit paths from non-file remote schemes", () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wit-idl-source-test-"));
        const witPath = path.join(tempDir, "world.wit");
        fs.writeFileSync(witPath, "package example:test; world w {}", "utf8");

        try {
            const uri: UriLike = { scheme: "vscode-remote", fsPath: witPath };
            expect(canUseWitPathGeneration(uri)).toBe(true);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it("returns false for non-.wit file paths", () => {
        const uri: UriLike = { scheme: "file", fsPath: "/tmp/component.wasm" };
        expect(canUseWitPathGeneration(uri)).toBe(false);
    });

    it("returns false for missing .wit paths", () => {
        const uri: UriLike = { scheme: "file", fsPath: path.join(os.tmpdir(), "missing-world.wit") };
        expect(canUseWitPathGeneration(uri)).toBe(false);
    });
});

describe("isExtractedWitFromWasm", () => {
    it("returns true for virtual wit-extract URIs backed by .wasm", () => {
        const uri: UriLike = { scheme: "wit-extract", fsPath: "/tmp/component.wasm" };
        expect(isExtractedWitFromWasm(uri)).toBe(true);
    });

    it("returns false for file-backed .wit URIs", () => {
        const uri: UriLike = { scheme: "file", fsPath: "/tmp/world.wit" };
        expect(isExtractedWitFromWasm(uri)).toBe(false);
    });

    it("returns false for wit-extract URIs not ending in .wasm", () => {
        const uri: UriLike = { scheme: "wit-extract", fsPath: "/tmp/world.wit" };
        expect(isExtractedWitFromWasm(uri)).toBe(false);
    });
});
