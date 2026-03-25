import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { generateBindingsFromWasm, validateWitSyntaxDetailedFromWasm } from "../src/wasmUtils.js";

describe("local import resolution", () => {
    const tempDirectories: string[] = [];

    afterEach(async () => {
        await Promise.all(tempDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
        tempDirectories.length = 0;
    });

    async function createIssue121Fixture(): Promise<{ content: string; sourcePath: string }> {
        const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "wit-idl-imports-"));
        tempDirectories.push(fixtureRoot);

        const witDirectory = path.join(fixtureRoot, "wit");
        await mkdir(witDirectory, { recursive: true });

        const sourcePath = path.join(witDirectory, "a.wit");
        await writeFile(
            sourcePath,
            `package local:demo;

world my-world {
    import host;

    export another-interface;
}

interface host {
    ping: func();
}
`,
            "utf8"
        );
        await writeFile(
            path.join(witDirectory, "b.wit"),
            `interface another-interface {
    pong: func();
}
`,
            "utf8"
        );

        return {
            content: await readFile(sourcePath, "utf8"),
            sourcePath,
        };
    }

    it("validates WIT with sibling imports when given a source path", async () => {
        const fixture = await createIssue121Fixture();

        const result = await validateWitSyntaxDetailedFromWasm(fixture.content, fixture.sourcePath);

        expect(result).toEqual({ valid: true });
    });

    it("uses unsaved editor content while still resolving sibling imports", async () => {
        const fixture = await createIssue121Fixture();
        const invalidContent = `${fixture.content}\nthis is not valid wit\n`;

        const result = await validateWitSyntaxDetailedFromWasm(invalidContent, fixture.sourcePath);

        expect(result.valid).toBe(false);
        expect(result.error).toContain(fixture.sourcePath);
    });

    it("generates bindings from in-memory content while resolving sibling imports", async () => {
        const fixture = await createIssue121Fixture();
        const updatedContent = fixture.content.replace("world my-world", "world staged-world");

        const files = await generateBindingsFromWasm(updatedContent, "rust", "staged-world", fixture.sourcePath);

        expect(files["error.txt"]).toBeUndefined();
        expect(Object.keys(files).some((filename) => filename.endsWith(".rs"))).toBe(true);
    });
});
