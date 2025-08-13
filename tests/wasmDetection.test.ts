import { describe, it, expect } from "vitest";
import { isWasmComponentVersion } from "../src/wasmDetection.js";

// Utility to build an 8-byte wasm header buffer
function wasmHeader(version: number): Uint8Array {
    const b = new Uint8Array(8);
    // magic: 00 61 73 6D
    b[0] = 0x00;
    b[1] = 0x61;
    b[2] = 0x73;
    b[3] = 0x6d;
    // version LE
    b[4] = version & 0xff;
    b[5] = (version >> 8) & 0xff;
    b[6] = (version >> 16) & 0xff;
    b[7] = (version >> 24) & 0xff;
    return b;
}

describe("wasm detection: version heuristic", () => {
    it("treats version 1 as core (not a component)", () => {
        const v = 1;
        expect(isWasmComponentVersion(v)).toBe(false);
        const hdr = wasmHeader(v);
        expect(hdr[0]).toBe(0x00);
        expect(hdr[1]).toBe(0x61);
        expect(hdr[2]).toBe(0x73);
        expect(hdr[3]).toBe(0x6d);
    });

    it("treats non-1 versions as component (e.g., 65549)", () => {
        const v = 65549; // observed for tests/grammar/add.wasm
        expect(isWasmComponentVersion(v)).toBe(true);
        const hdr = wasmHeader(v);
        expect(hdr[4] | (hdr[5] << 8) | (hdr[6] << 16) | (hdr[7] << 24)).toBe(v);
    });
});
