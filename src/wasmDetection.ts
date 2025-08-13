import * as fs from "fs";

/**
 * Read the first 8 bytes of a WebAssembly file and return header info.
 * - magic: 0x00 0x61 0x73 0x6D
 * - version: little-endian u32 following the magic
 *   • For core modules this is 0x01 0x00 0x00 0x00 (decimal 1)
 *   • For components, this u32 is interpreted as two u16 fields: version (LE) and layer (LE).
 *     Currently: version = 0x000d, layer = 0x0001 → combined u32 = 0x0001000d (decimal 65549).
 *
 * References:
 * - WebAssembly Core Binary Format (magic + version):
 *   https://webassembly.github.io/spec/core/binary/modules.html#binary-module
 * - WebAssembly Component Model Binary Format preamble (version + layer split):
 *   https://github.com/WebAssembly/component-model/blob/main/design/mvp/Binary.md#preamble
 */
export async function readWasmHeader(filePath: string): Promise<{ magicOk: boolean; version: number }> {
    try {
        const fd: number = fs.openSync(filePath, "r");
        try {
            const header: Buffer = Buffer.alloc(8);
            const bytesRead: number = fs.readSync(fd, header, 0, 8, 0);
            if (bytesRead < 8) {
                return { magicOk: false, version: 0 };
            }
            const magicOk: boolean =
                header[0] === 0x00 && header[1] === 0x61 && header[2] === 0x73 && header[3] === 0x6d;
            const version: number = header.readUInt32LE(4);
            return { magicOk, version };
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return { magicOk: false, version: 0 };
    }
}

/**
 * Determine if a wasm header's 4-byte field represents a component preamble.
 *
 * Per the Component Model preamble, the 4 bytes after the magic are interpreted as:
 *   version:u16 (LE), layer:u16 (LE).
 * Core modules have layer = 0; components have layer = 1.
 *
 * This function preserves the legacy heuristic (version !== 1) while making the
 * check robust by explicitly testing the layer field.
 */
export function isWasmComponentVersion(version: number): boolean {
    // Extract the 16-bit layer from the high word
    const layer: number = (version >>> 16) & 0xffff;
    if (version === 1) return false; // common fast-path for core v1
    return layer === 1;
}

/**
 * Determine if a file is a WebAssembly component based on its header.
 */
export async function isWasmComponentFile(filePath: string): Promise<boolean> {
    const { magicOk, version } = await readWasmHeader(filePath);
    return magicOk && isWasmComponentVersion(version);
}
