import * as fs from "node:fs";

/**
 * Minimal URI shape used for deciding whether WIT generation can use a file path.
 */
export interface UriLike {
    scheme: string;
    fsPath: string;
}

/**
 * Returns true when a URI points to an existing, file-backed `.wit` document.
 *
 * Path-based generation is preferred for real `.wit` files because it allows
 * `deps/` resolution. Virtual WIT views (for example `wit-extract:`) and
 * unsaved editors must use in-memory content generation.
 */
export function canUseWitPathGeneration(uri: UriLike): boolean {
    if (uri.scheme === "wit-extract") {
        return false;
    }

    const fsPath: string = uri.fsPath;
    if (!fsPath || !fsPath.toLowerCase().endsWith(".wit")) {
        return false;
    }

    return fs.existsSync(fsPath);
}

/**
 * Returns true when a URI represents the virtual extracted-WIT editor for a
 * backing `.wasm` component file.
 */
export function isExtractedWitFromWasm(uri: UriLike): boolean {
    return uri.scheme === "wit-extract" && uri.fsPath.toLowerCase().endsWith(".wasm");
}
