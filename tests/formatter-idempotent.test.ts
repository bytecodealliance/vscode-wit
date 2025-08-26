import { describe, it, expect, vi, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
vi.mock("vscode", () => ({}));
let formatter: import("../src/formatter.js").WitFormatter;

function collectWitFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectWitFiles(full, acc);
        } else if (entry.isFile() && entry.name.endsWith(".wit")) {
            acc.push(full);
        }
    }
    return acc;
}

describe("WIT formatter idempotency", () => {
    const testRoot = path.join(__dirname);
    const witFiles = collectWitFiles(testRoot).sort();
    beforeAll(async () => {
        const mod = await import("../src/formatter.js");
        formatter = new mod.WitFormatter();
    });

    it("should find at least one .wit test file", () => {
        expect(witFiles.length).toBeGreaterThan(0);
    });

    for (const file of witFiles) {
        it(path.relative(testRoot, file), () => {
            const original = fs.readFileSync(file, "utf8");
            const formatted = formatter.formatWitContent(original, { tabSize: 2, insertSpaces: true });
            const normalize = (s: string) => s.replace(/\r\n/g, "\n");
            const origHadFinalNewline = /\n$/.test(original);
            const nOriginal = normalize(original).replace(/\n+$/g, "") + (origHadFinalNewline ? "\n" : "");
            const nFormatted = normalize(formatted).replace(/\n+$/g, "") + (origHadFinalNewline ? "\n" : "");
            expect(nFormatted).toBe(nOriginal);
        });
    }
});
