import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { determineHostJsGenerationStrategy, type HostJsGenerationStrategy } from "../src/hostBindingsRouting.js";
import type { UriLike } from "../src/bindingsSource.js";

function strategyFor(targetUri: UriLike, isWitDoc: boolean): HostJsGenerationStrategy {
    return determineHostJsGenerationStrategy({ targetUri, isWitDoc });
}

describe("determineHostJsGenerationStrategy", () => {
    it("uses transpile path for extracted WIT views backed by wasm", () => {
        const uri: UriLike = { scheme: "wit-extract", fsPath: "/tmp/component.wasm" };
        expect(strategyFor(uri, true)).toBe("transpile-wasm-path");
    });

    it("uses transpile path for non-WIT wasm targets", () => {
        const uri: UriLike = { scheme: "file", fsPath: "/tmp/component.wasm" };
        expect(strategyFor(uri, false)).toBe("transpile-wasm-path");
    });

    it("uses path-based type generation for file-backed wit docs", () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wit-idl-routing-test-"));
        const witPath = path.join(tempDir, "world.wit");
        fs.writeFileSync(witPath, "package example:test; world w {}", "utf8");

        try {
            const uri: UriLike = { scheme: "file", fsPath: witPath };
            expect(strategyFor(uri, true)).toBe("types-wit-path");
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it("uses content-based type generation for virtual wit docs", () => {
        const uri: UriLike = { scheme: "untitled", fsPath: "/tmp/world.wit" };
        expect(strategyFor(uri, true)).toBe("types-wit-content");
    });

    it("returns unsupported for non-wit, non-wasm targets", () => {
        const uri: UriLike = { scheme: "file", fsPath: "/tmp/notes.txt" };
        expect(strategyFor(uri, false)).toBe("unsupported");
    });
});
