import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Binding mode: "guest" generates guest-side types, "host" generates host-side types.
 */
export type JsBindingsMode = "guest" | "host";

/**
 * Options for generating JavaScript bindings from WIT
 */
export interface JsBindingsOptions {
    /** WIT content as a string */
    witContent: string;
    /** Optional world name to target */
    worldName?: string;
}

/**
 * Result of JavaScript binding generation
 */
export interface JsBindingsResult {
    /** Map of relative file paths to file contents (as Uint8Array) */
    files: Record<string, Uint8Array>;
}

/**
 * Result of JavaScript host transpilation from a .wasm component
 */
export interface JsTranspileResult {
    /** Map of relative file paths to file contents (as Uint8Array) */
    files: Record<string, Uint8Array>;
    /** Import specifiers the generated JS needs at runtime */
    imports: string[];
    /** Exported items: [name, kind] tuples */
    exports: [string, "function" | "instance"][];
}

/**
 * Dynamically import jco's typesComponent function.
 *
 * The function is re-exported from `@bytecodealliance/jco` as `types`.
 * We use a dynamic import to avoid loading the module eagerly at startup.
 */
async function getTypesComponent(): Promise<
    (witPath: string, opts: { worldName?: string; guest?: boolean }) => Promise<Record<string, Uint8Array>>
> {
    const jco = (await import("@bytecodealliance/jco")) as {
        types: (witPath: string, opts: { worldName?: string; guest?: boolean }) => Promise<Record<string, Uint8Array>>;
    };
    return jco.types;
}

/**
 * Dynamically import jco's transpileComponent function.
 *
 * The function is re-exported from `@bytecodealliance/jco` as `transpile`.
 * It takes raw WebAssembly component bytes and produces the full JavaScript
 * host runtime (JS modules, TypeScript declarations, and embedded core .wasm files).
 */
async function getTranspileComponent(): Promise<
    (
        component: Uint8Array,
        opts?: {
            name?: string;
            instantiation?: "async" | "sync";
            map?: Record<string, string>;
            validLiftingOptimization?: boolean;
            tracing?: boolean;
            nodejsCompat?: boolean;
            tlaCompat?: boolean;
            base64Cutoff?: boolean;
            js?: boolean;
            minify?: boolean;
            optimize?: boolean;
            namespacedExports?: boolean;
            multiMemory?: boolean;
        }
    ) => Promise<{
        files: Record<string, Uint8Array>;
        imports: string[];
        exports: [string, "function" | "instance"][];
    }>
> {
    const jco = (await import("@bytecodealliance/jco")) as {
        transpile: (
            component: Uint8Array,
            opts?: Record<string, unknown>
        ) => Promise<{
            files: Record<string, Uint8Array>;
            imports: string[];
            exports: [string, "function" | "instance"][];
        }>;
    };
    return jco.transpile;
}

/**
 * Generate JavaScript/TypeScript bindings from WIT content.
 *
 * Uses `@bytecodealliance/jco` `typesComponent` to produce TypeScript
 * declaration files (.d.ts). In "guest" mode, generates guest module types;
 * in "host" mode, generates host-side types describing the component's
 * imports and exports from the host perspective.
 *
 * @param options - Options for generation
 * @param mode - "guest" or "host" (defaults to "guest")
 * @returns Map of filename to file content
 */
export async function generateJsBindings(
    options: JsBindingsOptions,
    mode: JsBindingsMode = "guest"
): Promise<JsBindingsResult> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `wit-idl-js-${mode}-`));
    const witFilePath = path.join(tmpDir, "input.wit");

    try {
        fs.writeFileSync(witFilePath, options.witContent, "utf8");

        const typesComponent = await getTypesComponent();
        const files = await typesComponent(witFilePath, {
            worldName: options.worldName,
            ...(mode === "guest" ? { guest: true } : {}),
        });

        return { files };
    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Generate JavaScript/TypeScript bindings from a WIT file path.
 *
 * Passes the path directly to jco without copying to a temp directory,
 * which allows resolution of dependencies in `deps/` directories.
 *
 * @param witPath - Absolute path to the WIT file or directory
 * @param mode - "guest" or "host" (defaults to "guest")
 * @param worldName - Optional world name to target
 * @returns Map of filename to file content
 */
export async function generateJsBindingsFromPath(
    witPath: string,
    mode: JsBindingsMode = "guest",
    worldName?: string
): Promise<JsBindingsResult> {
    const typesComponent = await getTypesComponent();
    const files = await typesComponent(witPath, {
        worldName,
        ...(mode === "guest" ? { guest: true } : {}),
    });

    return { files };
}

// ── Convenience aliases (preserve backward-compatible named exports) ──

/** @deprecated Use `generateJsBindings(options, "guest")` instead */
export const generateJsGuestBindings = (options: JsBindingsOptions): Promise<JsBindingsResult> =>
    generateJsBindings(options, "guest");

/** @deprecated Use `generateJsBindingsFromPath(path, "guest")` instead */
export const generateJsGuestBindingsFromPath = (witPath: string, worldName?: string): Promise<JsBindingsResult> =>
    generateJsBindingsFromPath(witPath, "guest", worldName);

/** @deprecated Use `generateJsBindings(options, "host")` instead */
export const generateJsHostBindings = (options: JsBindingsOptions): Promise<JsBindingsResult> =>
    generateJsBindings(options, "host");

/** @deprecated Use `generateJsBindingsFromPath(path, "host")` instead */
export const generateJsHostBindingsFromPath = (witPath: string, worldName?: string): Promise<JsBindingsResult> =>
    generateJsBindingsFromPath(witPath, "host", worldName);

// ── Full host transpilation (from .wasm component) ──

/**
 * Options for transpiling a WebAssembly component into a JavaScript host module.
 */
export interface JsTranspileOptions {
    /** Name for the generated module (derived from filename if omitted) */
    name?: string;
    /** Whether to generate an instantiation API ("async" | "sync") instead of a direct module */
    instantiation?: "async" | "sync";
    /** Enable Node.js compatibility mode (e.g. for fs/path shims) */
    nodejsCompat?: boolean;
    /** Enable tracing of component calls */
    tracing?: boolean;
    /** Generate .mjs instead of .js for broader ESM compat */
    tlaCompat?: boolean;
}

/**
 * Transpile a WebAssembly component into a full JavaScript host module.
 *
 * Uses `@bytecodealliance/jco` `transpileComponent` to produce:
 * - JavaScript ES module(s) that instantiate the component
 * - TypeScript declaration files (.d.ts) for type-safe usage
 * - Embedded core WebAssembly module(s) referenced by the JS
 *
 * This is the host-side counterpart to guest binding generation.
 * The output can be used directly from Node.js or bundled for the browser.
 *
 * @param componentBytes - Raw bytes of a WebAssembly component (.wasm)
 * @param options - Transpilation options
 * @returns Generated files, import specifiers, and export descriptors
 */
export async function transpileJsHost(
    componentBytes: Uint8Array,
    options?: JsTranspileOptions
): Promise<JsTranspileResult> {
    const transpileComponent = await getTranspileComponent();

    const name = options?.name ?? "component";
    const result = await transpileComponent(componentBytes, {
        name,
        instantiation: options?.instantiation,
        nodejsCompat: options?.nodejsCompat,
        tracing: options?.tracing,
        tlaCompat: options?.tlaCompat,
    });

    return {
        files: result.files,
        imports: result.imports,
        exports: result.exports,
    };
}

/**
 * Transpile a WebAssembly component file into a full JavaScript host module.
 *
 * Reads the file from disk and delegates to {@link transpileJsHost}.
 *
 * @param wasmPath - Absolute path to the .wasm component file
 * @param options - Transpilation options (name defaults to the file's base name)
 * @returns Generated files, import specifiers, and export descriptors
 */
export async function transpileJsHostFromPath(
    wasmPath: string,
    options?: JsTranspileOptions
): Promise<JsTranspileResult> {
    const componentBytes = fs.readFileSync(wasmPath);
    const name = options?.name ?? path.basename(wasmPath, ".wasm");
    return transpileJsHost(new Uint8Array(componentBytes), { ...options, name });
}
