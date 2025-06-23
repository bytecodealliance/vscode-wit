import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

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
        const extensionPath = vscode.extensions.getExtension("bytecodealliance.wit-idl")?.extensionPath;
        if (!extensionPath) {
            throw new Error("Extension path not found");
        }

        // Look for the WASM file in the extension's dist directory (bundled location)
        const wasmPath = path.join(extensionPath, "dist", "wit_bindgen_wasm_bg.wasm");

        if (fs.existsSync(wasmPath)) {
            const wasmBuffer = fs.readFileSync(wasmPath);
            await module.default(wasmBuffer);
        } else {
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
        throw new Error(`Failed to get version: ${error instanceof Error ? error.message : String(error)}`);
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
