import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readWasmHeader, isWasmComponentFile, isWasmComponentVersion } from "../src/wasmDetection.js";

/**
 * Build an 8-byte WASM header buffer with the given version u32 (LE).
 */
function buildWasmHeader(version: number): Buffer {
    const buf = Buffer.alloc(8);
    // magic: \0asm
    buf[0] = 0x00;
    buf[1] = 0x61;
    buf[2] = 0x73;
    buf[3] = 0x6d;
    buf.writeUInt32LE(version, 4);
    return buf;
}

describe("wasmDetection — file-based tests", () => {
    const tmpFiles: string[] = [];

    function writeTmpWasm(content: Buffer): string {
        const tmpDir = os.tmpdir();
        const filePath = path.join(tmpDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.wasm`);
        fs.writeFileSync(filePath, content);
        tmpFiles.push(filePath);
        return filePath;
    }

    afterEach(() => {
        for (const f of tmpFiles) {
            try {
                fs.unlinkSync(f);
            } catch {
                // ignore
            }
        }
        tmpFiles.length = 0;
    });

    describe("readWasmHeader", () => {
        it("should read a valid core module header (version 1)", async () => {
            const filePath = writeTmpWasm(buildWasmHeader(1));
            const result = await readWasmHeader(filePath);
            expect(result.magicOk).toBe(true);
            expect(result.version).toBe(1);
        });

        it("should read a valid component header (version 65549)", async () => {
            const filePath = writeTmpWasm(buildWasmHeader(65549));
            const result = await readWasmHeader(filePath);
            expect(result.magicOk).toBe(true);
            expect(result.version).toBe(65549);
        });

        it("should return magicOk=false for non-WASM file", async () => {
            const filePath = writeTmpWasm(Buffer.from("not a wasm file!"));
            const result = await readWasmHeader(filePath);
            expect(result.magicOk).toBe(false);
        });

        it("should return magicOk=false for file shorter than 8 bytes", async () => {
            const filePath = writeTmpWasm(Buffer.from([0x00, 0x61, 0x73]));
            const result = await readWasmHeader(filePath);
            expect(result.magicOk).toBe(false);
            expect(result.version).toBe(0);
        });

        it("should return magicOk=false for non-existent file", async () => {
            const result = await readWasmHeader("/nonexistent/path/to/file.wasm");
            expect(result.magicOk).toBe(false);
            expect(result.version).toBe(0);
        });

        it("should handle empty file", async () => {
            const filePath = writeTmpWasm(Buffer.alloc(0));
            const result = await readWasmHeader(filePath);
            expect(result.magicOk).toBe(false);
            expect(result.version).toBe(0);
        });
    });

    describe("isWasmComponentFile", () => {
        it("should return true for a component WASM file", async () => {
            const filePath = writeTmpWasm(buildWasmHeader(65549));
            expect(await isWasmComponentFile(filePath)).toBe(true);
        });

        it("should return false for a core WASM module", async () => {
            const filePath = writeTmpWasm(buildWasmHeader(1));
            expect(await isWasmComponentFile(filePath)).toBe(false);
        });

        it("should return false for a non-WASM file", async () => {
            const filePath = writeTmpWasm(Buffer.from("hello world"));
            expect(await isWasmComponentFile(filePath)).toBe(false);
        });

        it("should return false for non-existent file", async () => {
            expect(await isWasmComponentFile("/does/not/exist.wasm")).toBe(false);
        });
    });

    describe("isWasmComponentVersion — additional edge cases", () => {
        it("should return false for version 0", () => {
            expect(isWasmComponentVersion(0)).toBe(false);
        });

        it("should return true for a version with layer=1, version=13 (0x0001000d = 65549)", () => {
            expect(isWasmComponentVersion(0x0001_000d)).toBe(true);
        });

        it("should return false for large version with layer=0", () => {
            // layer=0, version=0xFFFF
            expect(isWasmComponentVersion(0x0000_ffff)).toBe(false);
        });

        it("should return true for hypothetical future component versions (layer=1)", () => {
            // layer=1, version=0x0100
            expect(isWasmComponentVersion(0x0001_0100)).toBe(true);
        });
    });
});
