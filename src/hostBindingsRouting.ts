import type { UriLike } from "./bindingsSource.js";
import { canUseWitPathGeneration, isExtractedWitFromWasm } from "./bindingsSource.js";

export type HostJsGenerationStrategy = "transpile-wasm-path" | "types-wit-path" | "types-wit-content" | "unsupported";

export interface HostJsRoutingInput {
    targetUri: UriLike;
    isWitDoc: boolean;
}

/**
 * Determines which generation strategy should be used for host-side JavaScript output.
 */
export function determineHostJsGenerationStrategy(input: HostJsRoutingInput): HostJsGenerationStrategy {
    const { targetUri, isWitDoc } = input;

    if (isWitDoc) {
        if (isExtractedWitFromWasm(targetUri)) {
            return "transpile-wasm-path";
        }

        return canUseWitPathGeneration(targetUri) ? "types-wit-path" : "types-wit-content";
    }

    if (targetUri.fsPath.toLowerCase().endsWith(".wasm")) {
        return "transpile-wasm-path";
    }

    return "unsupported";
}
