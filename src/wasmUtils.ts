import * as vscode from "vscode";

// Import the WASM module types
import type { WitBindgen } from "wit-bindgen-wasm";

/**
 * WASM module instance for WIT bindgen functionality
 */
let wasmModule: typeof import("wit-bindgen-wasm") | null = null;

/**
 * Initialize the WASM module
 * @returns Promise that resolves when the module is loaded
 */
export async function initializeWasm(): Promise<void> {
    if (wasmModule) {
        return; // Already initialized
    }

    try {
        // Import the WASM module
        const module = await import("wit-bindgen-wasm");

        // Initialize the WASM module with the binary
        const ext = vscode.extensions.getExtension("bytecodealliance.wit-idl");
        if (!ext) {
            throw new Error("Extension path not found");
        }

        // Look for the WASM file in the extension's dist directory (bundled location)
        const wasmUri = vscode.Uri.joinPath(ext.extensionUri, "dist", "wit_bindgen_wasm_bg.wasm");

        try {
            // Check if the file exists; stat will throw if it doesn't
            await vscode.workspace.fs.stat(wasmUri);
            const wasmBuffer = await vscode.workspace.fs.readFile(wasmUri);
            await module.default(wasmBuffer);
        } catch {
            // Fallback: try to initialize without explicit path
            await module.default();
        }

        wasmModule = module;
        console.log("WIT bindgen WASM module initialized successfully");
    } catch (error) {
        console.error("Failed to initialize WIT bindgen WASM module:", error);
        throw error;
    }
}

/**
 * Get the WIT bindgen version from the WASM module
 * @returns Promise that resolves to the version string
 */
export async function getWitBindgenVersionFromWasm(): Promise<string> {
    if (!wasmModule) {
        await initializeWasm();
    }

    if (!wasmModule) {
        throw new Error("WASM module not initialized");
    }

    try {
        const instance = new wasmModule.WitBindgen();
        const version = instance.version();
        instance.free();
        return version;
    } catch (error) {
        console.error("Failed to get version from WASM module:", error);
        throw new Error(`Failed to get version: ${error instanceof Error ? error.message : String(error)}`, {
            cause: error,
        });
    }
}

/**
 * Create a WIT bindgen instance for validation
 * @returns Promise that resolves to a WitBindgen instance
 */
export async function createWitBindgenInstance(): Promise<WitBindgen> {
    if (!wasmModule) {
        await initializeWasm();
    }

    if (!wasmModule) {
        throw new Error("WASM module not initialized");
    }

    return new wasmModule.WitBindgen();
}

/**
 * Check if a filename has a .wit extension
 * @param filename - The filename to check
 * @returns Promise that resolves to true if the file has a .wit extension
 */
export async function isWitFileExtensionFromWasm(filename: string): Promise<boolean> {
    return filename.toLowerCase().endsWith(".wit");
}

/**
 * Validate WIT syntax using the WASM module
 * @param content - The WIT content to validate
 * @returns Promise that resolves to true if the syntax is valid
 */
export async function validateWitSyntaxFromWasm(content: string): Promise<boolean> {
    const instance = await createWitBindgenInstance();
    try {
        return instance.validateWitSyntax(content);
    } finally {
        instance.free();
    }
}

/**
 * Extract WIT text from a WebAssembly component using the WASM module.
 * The underlying WASM must implement `extractWitFromComponent(bytes: Uint8Array): string`.
 * @param bytes - The WebAssembly component bytes
 * @returns Promise resolving to extracted WIT text
 */
export async function extractWitFromComponent(bytes: Uint8Array): Promise<string> {
    if (!wasmModule) {
        await initializeWasm();
    }

    if (!wasmModule) {
        throw new Error("WASM module not initialized");
    }

    // Type guard for extractWitFromComponent method
    function hasExtractWitFromComponent(
        obj: unknown
    ): obj is { extractWitFromComponent: (data: Uint8Array) => string } {
        return typeof (obj as { extractWitFromComponent?: unknown }).extractWitFromComponent === "function";
    }

    // Create instance and call the optional method via a type-guarded access
    const instance = new wasmModule.WitBindgen();
    try {
        if (!hasExtractWitFromComponent(instance)) {
            throw new Error("extractWitFromComponent not available in wit-bindgen-wasm module");
        }
        const witText = instance.extractWitFromComponent(bytes);
        if (!witText || typeof witText !== "string") {
            throw new Error("WIT extraction returned no data");
        }
        return witText;
    } finally {
        instance.free();
    }
}

/**
 * Extract core wasm module(s) from a WebAssembly component using the WASM module.
 * Returns a filename -> binary bytes map. Empty map on failure or none found.
 */
export async function extractCoreWasmFromComponent(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
    if (!wasmModule) {
        await initializeWasm();
    }
    if (!wasmModule) {
        throw new Error("WASM module not initialized");
    }

    function hasExtractCore(obj: unknown): obj is { extractCoreWasmFromComponent: (data: Uint8Array) => string } {
        return typeof (obj as { extractCoreWasmFromComponent?: unknown }).extractCoreWasmFromComponent === "function";
    }

    const instance = new wasmModule.WitBindgen();
    try {
        if (!hasExtractCore(instance)) {
            throw new Error("extractCoreWasmFromComponent not available in wit-bindgen-wasm module");
        }
        const json = instance.extractCoreWasmFromComponent(bytes);
        const textMap = JSON.parse(json || "{}") as Record<string, string>;
        // Decode into binary bytes (latin1-to-bytes convention from WASM side)
        const result: Record<string, Uint8Array> = {};
        for (const [name, content] of Object.entries(textMap)) {
            // Buffer.from with 'latin1' yields the original byte values 0..255
            result[name] = Buffer.from(content, "latin1");
        }
        return result;
    } finally {
        instance.free();
    }
}

/**
 * Extract interfaces from WIT content using the WASM module
 * @param content - The WIT content to parse
 * @returns Promise that resolves to a comma-separated list of interface names
 */
export async function extractInterfacesFromWasm(content: string): Promise<string> {
    const instance = await createWitBindgenInstance();
    try {
        return instance.extractInterfaces(content);
    } finally {
        instance.free();
    }
}

/**
 * Generate language-specific bindings from WIT content using the WASM module
 * @param content - The WIT content to generate bindings for
 * @param language - Target language (rust, c, csharp, go, moonbit)
 * @param worldName - Optional world name to use for bindings
 * @returns Promise that resolves to a map of filename to content
 */
export async function generateBindingsFromWasm(
    content: string,
    language: string,
    worldName?: string
): Promise<Record<string, string>> {
    const instance = await createWitBindgenInstance();
    try {
        const jsonResult = instance.generateBindings(content, language, worldName);
        return JSON.parse(jsonResult);
    } finally {
        instance.free();
    }
}

/**
 * Detailed validation result from WASM module
 */
export interface WitValidationResult {
    valid: boolean;
    error?: string;
    errorType?: "parsing" | "resolution" | "dependency" | "validation";
}

/**
 * Validate WIT syntax using the WASM module with detailed error information
 * @param content - The WIT content to validate
 * @returns Promise that resolves to detailed validation results
 */
export async function validateWitSyntaxDetailedFromWasm(content: string): Promise<WitValidationResult> {
    const instance = await createWitBindgenInstance();
    try {
        const resultJson = instance.validateWitSyntaxDetailed(content);
        return JSON.parse(resultJson);
    } finally {
        instance.free();
    }
}
