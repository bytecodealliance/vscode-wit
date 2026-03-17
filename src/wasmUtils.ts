/**
 * Cached reference to the witValidator interface from the WASM component module.
 * The jco-transpiled module self-initializes via top-level await,
 * so the module is ready to use once the dynamic import resolves.
 */
let witValidatorApi: typeof import("wit-bindgen-wasm").witValidator | null = null;

/**
 * Initialize the WASM module by dynamically importing it.
 * The jco-transpiled component handles WASM loading internally.
 * @returns Promise that resolves when the module is loaded
 */
export async function initializeWasm(): Promise<void> {
    if (witValidatorApi) {
        return; // Already initialized
    }

    try {
        const module = await import("wit-bindgen-wasm");
        witValidatorApi = module.witValidator;
        console.log("WIT bindgen WASM component module initialized successfully");
    } catch (error) {
        console.error("Failed to initialize WIT bindgen WASM component module:", error);
        throw error;
    }
}

/**
 * Get the witValidator API, initializing if needed.
 */
async function getApi(): Promise<typeof import("wit-bindgen-wasm").witValidator> {
    if (!witValidatorApi) {
        await initializeWasm();
    }
    if (!witValidatorApi) {
        throw new Error("WASM module not initialized");
    }
    return witValidatorApi;
}

/**
 * Get the WIT bindgen version from the WASM module
 * @returns Promise that resolves to the version string
 */
export async function getWitBindgenVersionFromWasm(): Promise<string> {
    const api = await getApi();
    try {
        return api.version();
    } catch (error) {
        console.error("Failed to get version from WASM module:", error);
        throw new Error(`Failed to get version: ${error instanceof Error ? error.message : String(error)}`, {
            cause: error,
        });
    }
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
    const api = await getApi();
    return api.validateWitSyntax(content);
}

/**
 * Extract WIT text from a WebAssembly component using the WASM module.
 * @param bytes - The WebAssembly component bytes
 * @returns Promise resolving to extracted WIT text
 */
export async function extractWitFromComponent(bytes: Uint8Array): Promise<string> {
    const api = await getApi();
    const witText = api.extractWitFromComponent(bytes);
    if (!witText) {
        throw new Error("WIT extraction returned no data");
    }
    return witText;
}

/**
 * Extract core wasm module(s) from a WebAssembly component using the WASM module.
 * Returns a filename -> binary bytes map. Empty map on failure or none found.
 */
export async function extractCoreWasmFromComponent(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
    const api = await getApi();
    const json = api.extractCoreWasmFromComponent(bytes);
    const textMap = JSON.parse(json || "{}") as Record<string, string>;
    const result: Record<string, Uint8Array> = {};
    for (const [name, content] of Object.entries(textMap)) {
        result[name] = Buffer.from(content, "latin1");
    }
    return result;
}

/**
 * Extract interfaces from WIT content using the WASM module
 * @param content - The WIT content to parse
 * @returns Promise that resolves to a comma-separated list of interface names
 */
export async function extractInterfacesFromWasm(content: string): Promise<string> {
    const api = await getApi();
    return api.extractInterfaces(content);
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
    const api = await getApi();
    const jsonResult = api.generateBindings(content, language, worldName);
    return JSON.parse(jsonResult);
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
    const api = await getApi();
    const resultJson = api.validateWitSyntaxDetailed(content);
    return JSON.parse(resultJson);
}
