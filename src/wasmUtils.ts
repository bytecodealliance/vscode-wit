import { readdir, readFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

/**
 * Cached reference to the witValidator interface from the WASM component module.
 * The jco-transpiled module self-initializes via top-level await,
 * so the module is ready to use once the dynamic import resolves.
 */
let witValidatorApi: typeof import("wit-bindgen-wasm").witValidator | null = null;

interface PreparedSourceContext {
    sourcePath?: string;
    sourceFilesJson?: string;
}

function normalizeSourcePath(sourcePath?: string): string | undefined {
    const trimmedPath = sourcePath?.trim();
    if (!trimmedPath) {
        return undefined;
    }

    return path.resolve(trimmedPath);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && "code" in error;
}

async function readDirectoryEntries(directoryPath: string): Promise<Array<Dirent>> {
    try {
        return await readdir(directoryPath, { encoding: "utf8", withFileTypes: true });
    } catch (error: unknown) {
        if (isErrnoException(error) && error.code === "ENOENT") {
            return [];
        }

        throw error;
    }
}

async function collectWitFilePathsRecursively(directoryPath: string, filePaths: Array<string>): Promise<void> {
    const entries = await readDirectoryEntries(directoryPath);
    for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            await collectWitFilePathsRecursively(entryPath, filePaths);
            continue;
        }

        if (entry.isFile() && entry.name.toLowerCase().endsWith(".wit")) {
            filePaths.push(entryPath);
        }
    }
}

async function readWitFilesWithConcurrency(filePaths: Array<string>, target: Record<string, string>): Promise<void> {
    if (filePaths.length === 0) {
        return;
    }

    const maxConcurrency = 8;
    let currentIndex = 0;

    const worker = async (): Promise<void> => {
        while (true) {
            const index = currentIndex;
            if (index >= filePaths.length) {
                return;
            }

            currentIndex += 1;
            const filePath = filePaths[index];
            try {
                const contents = await readFile(filePath, "utf8");
                target[filePath] = contents;
            } catch (error: unknown) {
                if (isErrnoException(error) && (error.code === "ENOENT" || error.code === "EACCES")) {
                    // Skip files that are missing or not accessible without failing the whole operation.
                    continue;
                }

                throw error;
            }
        }
    };

    const workerCount = Math.min(maxConcurrency, filePaths.length);
    const workers: Array<Promise<void>> = [];
    for (let i = 0; i < workerCount; i += 1) {
        workers.push(worker());
    }

    await Promise.all(workers);
}

async function collectWitContext(sourceDirectory: string): Promise<Record<string, string>> {
    const sourceFiles: Record<string, string> = {};
    const filePaths: Array<string> = [];

    const entries = await readDirectoryEntries(sourceDirectory);
    for (const entry of entries) {
        const entryPath = path.join(sourceDirectory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "deps") {
                await collectWitFilePathsRecursively(entryPath, filePaths);
            }
            continue;
        }

        if (entry.isFile() && entry.name.toLowerCase().endsWith(".wit")) {
            filePaths.push(entryPath);
        }
    }

    await readWitFilesWithConcurrency(filePaths, sourceFiles);
    return sourceFiles;
}

async function prepareSourceContext(content: string, sourcePath?: string): Promise<PreparedSourceContext> {
    const normalizedSourcePath = normalizeSourcePath(sourcePath);
    if (!normalizedSourcePath) {
        return {};
    }

    const sourceFiles = await collectWitContext(path.dirname(normalizedSourcePath));
    sourceFiles[normalizedSourcePath] = content;

    return {
        sourcePath: normalizedSourcePath,
        sourceFilesJson: JSON.stringify(sourceFiles),
    };
}

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
export async function validateWitSyntaxFromWasm(content: string, sourcePath?: string): Promise<boolean> {
    const api = await getApi();
    const preparedSource = await prepareSourceContext(content, sourcePath);
    return api.validateWitSyntax(content, preparedSource.sourcePath, preparedSource.sourceFilesJson);
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
    worldName?: string,
    sourcePath?: string
): Promise<Record<string, string>> {
    const api = await getApi();
    const preparedSource = await prepareSourceContext(content, sourcePath);
    const jsonResult = api.generateBindings(
        content,
        language,
        worldName,
        preparedSource.sourcePath,
        preparedSource.sourceFilesJson
    );
    return JSON.parse(jsonResult) as Record<string, string>;
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
export async function validateWitSyntaxDetailedFromWasm(
    content: string,
    sourcePath?: string
): Promise<WitValidationResult> {
    const api = await getApi();
    const preparedSource = await prepareSourceContext(content, sourcePath);
    const resultJson = api.validateWitSyntaxDetailed(
        content,
        preparedSource.sourcePath,
        preparedSource.sourceFilesJson
    );
    return JSON.parse(resultJson) as WitValidationResult;
}
