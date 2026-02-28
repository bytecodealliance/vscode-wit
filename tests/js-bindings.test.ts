import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    generateJsBindings,
    generateJsBindingsFromPath,
    generateJsGuestBindings,
    generateJsGuestBindingsFromPath,
    generateJsHostBindings,
    generateJsHostBindingsFromPath,
    transpileJsHost,
    transpileJsHostFromPath,
} from "../src/jsBindings.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Build a minimal WebAssembly component from inline WIT source
 * using jco's componentEmbed + componentNew.
 */
async function buildComponentFromWit(witSource: string): Promise<Uint8Array> {
    const jco = (await import("@bytecodealliance/jco")) as {
        componentEmbed: (opts: { witSource: string; dummy: boolean }) => Promise<Uint8Array>;
        componentNew: (binary: Uint8Array, adapters: unknown[]) => Promise<Uint8Array>;
    };
    const embedded = await jco.componentEmbed({ witSource, dummy: true });
    return jco.componentNew(embedded, []);
}

const TEST_WIT = `package example:test;

world test-world {
    export greet: func(name: string) -> string;
}
`;

const COMPLEX_WIT = `package example:complex;

interface logger {
    enum level {
        debug,
        info,
        warn,
        error,
    }

    record entry {
        level: level,
        message: string,
    }

    log: func(entry: entry);
}

world app {
    import logger;
    export run: func() -> result<_, string>;
}
`;

describe("JavaScript Guest Bindings Generation", () => {
    it("should generate .d.ts files from WIT content", async () => {
        const result = await generateJsBindings({ witContent: TEST_WIT }, "guest");

        expect(result.files).toBeDefined();
        const filenames = Object.keys(result.files);
        expect(filenames.length).toBeGreaterThan(0);

        const hasDtsFile = filenames.some((f) => f.endsWith(".d.ts"));
        expect(hasDtsFile).toBe(true);

        console.log(`✅ JS guest bindings: Generated ${filenames.length} file(s): ${filenames.join(", ")}`);
    });

    it("should generate files containing TypeScript type declarations", async () => {
        const result = await generateJsBindings({ witContent: TEST_WIT }, "guest");
        const filenames = Object.keys(result.files);

        const dtsFile = filenames.find((f) => f.endsWith(".d.ts"));
        expect(dtsFile).toBeDefined();

        if (dtsFile) {
            const content = new TextDecoder().decode(result.files[dtsFile]);
            expect(content.length).toBeGreaterThan(0);
            expect(content).toMatch(/export|import|interface|type|declare/);

            console.log(`✅ JS guest bindings: ${dtsFile} contains TypeScript declarations (${content.length} bytes)`);
        }
    });

    it("should handle complex WIT definitions with interfaces and records", async () => {
        const result = await generateJsBindings({ witContent: COMPLEX_WIT }, "guest");

        expect(result.files).toBeDefined();
        const filenames = Object.keys(result.files);
        expect(filenames.length).toBeGreaterThan(0);

        const hasDtsFile = filenames.some((f) => f.endsWith(".d.ts"));
        expect(hasDtsFile).toBe(true);

        console.log(`✅ JS guest bindings: Complex WIT generated ${filenames.length} file(s): ${filenames.join(", ")}`);
    });

    it("should generate files from a WIT file path", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wit-idl-test-"));
        const witFile = path.join(tmpDir, "test.wit");
        fs.writeFileSync(witFile, TEST_WIT, "utf8");

        try {
            const result = await generateJsBindingsFromPath(witFile, "guest");

            expect(result.files).toBeDefined();
            const filenames = Object.keys(result.files);
            expect(filenames.length).toBeGreaterThan(0);

            const hasDtsFile = filenames.some((f) => f.endsWith(".d.ts"));
            expect(hasDtsFile).toBe(true);

            console.log(`✅ JS guest bindings from path: Generated ${filenames.length} file(s)`);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("should produce different output than wit-bindgen languages", async () => {
        const result = await generateJsBindings({ witContent: TEST_WIT }, "guest");
        const filenames = Object.keys(result.files);

        const hasRust = filenames.some((f) => f.endsWith(".rs"));
        const hasC = filenames.some((f) => f.endsWith(".h") || f.endsWith(".c"));
        const hasGo = filenames.some((f) => f.endsWith(".go"));

        expect(hasRust).toBe(false);
        expect(hasC).toBe(false);
        expect(hasGo).toBe(false);

        const hasDts = filenames.some((f) => f.endsWith(".d.ts"));
        expect(hasDts).toBe(true);
    });

    it("should reject empty WIT content", async () => {
        await expect(generateJsBindings({ witContent: "" }, "guest")).rejects.toThrow();
    });

    it("convenience alias works the same as core function", async () => {
        const aliasResult = await generateJsGuestBindings({ witContent: TEST_WIT });
        const coreResult = await generateJsBindings({ witContent: TEST_WIT }, "guest");

        expect(Object.keys(aliasResult.files).sort()).toEqual(Object.keys(coreResult.files).sort());
    });

    it("path alias works the same as core path function", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wit-idl-test-guest-alias-"));
        const witFile = path.join(tmpDir, "test.wit");
        fs.writeFileSync(witFile, TEST_WIT, "utf8");

        try {
            const aliasResult = await generateJsGuestBindingsFromPath(witFile);
            const coreResult = await generateJsBindingsFromPath(witFile, "guest");
            expect(Object.keys(aliasResult.files).sort()).toEqual(Object.keys(coreResult.files).sort());
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});

describe("JavaScript Host Bindings Generation", () => {
    it("should generate .d.ts files from WIT content", async () => {
        const result = await generateJsBindings({ witContent: TEST_WIT }, "host");

        expect(result.files).toBeDefined();
        const filenames = Object.keys(result.files);
        expect(filenames.length).toBeGreaterThan(0);

        const hasDtsFile = filenames.some((f) => f.endsWith(".d.ts"));
        expect(hasDtsFile).toBe(true);

        console.log(`✅ JS host bindings: Generated ${filenames.length} file(s): ${filenames.join(", ")}`);
    });

    it("should generate host-side type declarations", async () => {
        const result = await generateJsBindings({ witContent: TEST_WIT }, "host");
        const filenames = Object.keys(result.files);

        const dtsFile = filenames.find((f) => f.endsWith(".d.ts"));
        expect(dtsFile).toBeDefined();

        if (dtsFile) {
            const content = new TextDecoder().decode(result.files[dtsFile]);
            expect(content.length).toBeGreaterThan(0);
            expect(content).toMatch(/export|import|interface|type|declare/);

            console.log(`✅ JS host bindings: ${dtsFile} contains TypeScript declarations (${content.length} bytes)`);
        }
    });

    it("should produce different output than guest bindings", async () => {
        const guestResult = await generateJsBindings({ witContent: TEST_WIT }, "guest");
        const hostResult = await generateJsBindings({ witContent: TEST_WIT }, "host");

        const guestFiles = Object.keys(guestResult.files);
        const hostFiles = Object.keys(hostResult.files);

        expect(guestFiles.length).toBeGreaterThan(0);
        expect(hostFiles.length).toBeGreaterThan(0);

        const guestDts = guestFiles.find((f) => f.endsWith(".d.ts"));
        const hostDts = hostFiles.find((f) => f.endsWith(".d.ts"));
        if (guestDts && hostDts) {
            const guestContent = new TextDecoder().decode(guestResult.files[guestDts]);
            const hostContent = new TextDecoder().decode(hostResult.files[hostDts]);
            expect(guestContent).not.toBe(hostContent);
        }

        console.log(`✅ JS host vs guest: guest=${guestFiles.length} files, host=${hostFiles.length} files`);
    });

    it("should handle complex WIT definitions", async () => {
        const result = await generateJsBindings({ witContent: COMPLEX_WIT }, "host");

        expect(result.files).toBeDefined();
        const filenames = Object.keys(result.files);
        expect(filenames.length).toBeGreaterThan(0);

        console.log(`✅ JS host bindings: Complex WIT generated ${filenames.length} file(s): ${filenames.join(", ")}`);
    });

    it("should generate files from a WIT file path", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wit-idl-test-host-"));
        const witFile = path.join(tmpDir, "test.wit");
        fs.writeFileSync(witFile, TEST_WIT, "utf8");

        try {
            const result = await generateJsBindingsFromPath(witFile, "host");

            expect(result.files).toBeDefined();
            const filenames = Object.keys(result.files);
            expect(filenames.length).toBeGreaterThan(0);

            const hasDtsFile = filenames.some((f) => f.endsWith(".d.ts"));
            expect(hasDtsFile).toBe(true);

            console.log(`✅ JS host bindings from path: Generated ${filenames.length} file(s)`);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("should reject empty WIT content", async () => {
        await expect(generateJsBindings({ witContent: "" }, "host")).rejects.toThrow();
    });

    it("convenience alias works the same as core function", async () => {
        const aliasResult = await generateJsHostBindings({ witContent: TEST_WIT });
        const coreResult = await generateJsBindings({ witContent: TEST_WIT }, "host");

        expect(Object.keys(aliasResult.files).sort()).toEqual(Object.keys(coreResult.files).sort());
    });

    it("path alias works the same as core path function", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wit-idl-test-host-alias-"));
        const witFile = path.join(tmpDir, "test.wit");
        fs.writeFileSync(witFile, TEST_WIT, "utf8");

        try {
            const aliasResult = await generateJsHostBindingsFromPath(witFile);
            const coreResult = await generateJsBindingsFromPath(witFile, "host");
            expect(Object.keys(aliasResult.files).sort()).toEqual(Object.keys(coreResult.files).sort());
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});

describe("JavaScript bindings command contributions", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
        contributes: {
            commands: { command: string; title: string }[];
            menus: Record<string, { command?: string; when?: string; submenu?: string }[]>;
            submenus: { id: string; label: string }[];
        };
    };

    it("includes Generate JavaScript Bindings command for guests", () => {
        const cmd = pkg.contributes.commands.find((c) => c.command === "wit-idl.generateGuestBindingsJavaScript");
        expect(cmd).toBeTruthy();
        expect(cmd?.title).toBe("Generate JavaScript Bindings");
    });

    it("includes Generate JavaScript Bindings command for hosts", () => {
        const cmd = pkg.contributes.commands.find((c) => c.command === "wit-idl.generateHostBindingsJavaScript");
        expect(cmd).toBeTruthy();
        expect(cmd?.title).toBe("Generate JavaScript Bindings");
    });

    it("all guest binding commands use generateGuestBindings prefix", () => {
        const guestCommands = pkg.contributes.commands.filter((c) =>
            c.command.startsWith("wit-idl.generateGuestBindings")
        );
        expect(guestCommands.length).toBeGreaterThanOrEqual(7);
        for (const cmd of guestCommands) {
            expect(cmd.title).toMatch(/^Generate .+ Bindings$/);
        }
    });

    it("guest JS command is in the generate guest bindings submenu", () => {
        const submenu = pkg.contributes.menus["wit-idl.generateBindings.submenu"] || [];
        expect(submenu.some((m) => m.command === "wit-idl.generateGuestBindingsJavaScript")).toBe(true);
    });

    it("host JS command is in the generate host bindings submenu", () => {
        const submenu = pkg.contributes.menus["wit-idl.generateHostBindings.submenu"] || [];
        expect(submenu.some((m) => m.command === "wit-idl.generateHostBindingsJavaScript")).toBe(true);
    });

    it("guest bindings submenu label includes 'Guest'", () => {
        const submenu = pkg.contributes.submenus.find((s) => s.id === "wit-idl.generateBindings.submenu");
        expect(submenu).toBeTruthy();
        expect(submenu?.label).toContain("Guest");
    });

    it("host bindings submenu label includes 'Host'", () => {
        const submenu = pkg.contributes.submenus.find((s) => s.id === "wit-idl.generateHostBindings.submenu");
        expect(submenu).toBeTruthy();
        expect(submenu?.label).toContain("Host");
    });

    it("documentation submenu exists with markdown command", () => {
        const submenu = pkg.contributes.submenus.find((s) => s.id === "wit-idl.generateDocs.submenu");
        expect(submenu).toBeTruthy();
        expect(submenu?.label).toContain("Documentation");
        const docsMenu = pkg.contributes.menus["wit-idl.generateDocs.submenu"] || [];
        expect(docsMenu.some((m) => m.command === "wit-idl.generateDocMarkdown")).toBe(true);
    });

    it("guest JS is in the command palette with correct when clause", () => {
        const palette = pkg.contributes.menus.commandPalette || [];
        const entry = palette.find((m) => m.command === "wit-idl.generateGuestBindingsJavaScript");
        expect(entry).toBeTruthy();
        expect(entry?.when).toMatch(/editorLangId == wit|witIdl\.isWasmComponent/);
    });

    it("host JS is in the command palette with correct when clause", () => {
        const palette = pkg.contributes.menus.commandPalette || [];
        const entry = palette.find((m) => m.command === "wit-idl.generateHostBindingsJavaScript");
        expect(entry).toBeTruthy();
        expect(entry?.when).toMatch(/editorLangId == wit|witIdl\.isWasmComponent/);
    });
});

describe("JavaScript Host Transpilation (from .wasm component)", () => {
    it("should transpile a simple component into JS + .d.ts files", async () => {
        const component = await buildComponentFromWit(TEST_WIT);
        const result = await transpileJsHost(component, { name: "test-world" });

        expect(result.files).toBeDefined();
        const filenames = Object.keys(result.files);
        expect(filenames.length).toBeGreaterThan(0);

        const hasJs = filenames.some((f) => f.endsWith(".js") || f.endsWith(".mjs"));
        const hasDts = filenames.some((f) => f.endsWith(".d.ts"));
        expect(hasJs).toBe(true);
        expect(hasDts).toBe(true);

        console.log(`✅ Host transpile: Generated ${filenames.length} file(s): ${filenames.join(", ")}`);
    });

    it("should produce a runnable JS module with imports/exports metadata", async () => {
        const component = await buildComponentFromWit(TEST_WIT);
        const result = await transpileJsHost(component, { name: "test-world" });

        // The test WIT exports greet
        expect(result.exports.length).toBeGreaterThan(0);
        expect(result.exports).toContainEqual(["greet", "function"]);

        // No imports in this simple world
        expect(result.imports).toEqual([]);

        // The JS file should contain executable module code (not just types)
        const jsFile = Object.keys(result.files).find((f) => f.endsWith(".js") || f.endsWith(".mjs"));
        expect(jsFile).toBeDefined();
        if (jsFile) {
            const jsContent = new TextDecoder().decode(result.files[jsFile]);
            expect(jsContent.length).toBeGreaterThan(100);
        }
    });

    it("should handle complex WIT with imports and interfaces", async () => {
        const component = await buildComponentFromWit(COMPLEX_WIT);
        const result = await transpileJsHost(component, { name: "app" });

        const filenames = Object.keys(result.files);
        expect(filenames.length).toBeGreaterThan(0);

        // The complex WIT imports logger
        expect(result.imports.length).toBeGreaterThan(0);

        // Exports run
        expect(result.exports).toContainEqual(["run", "function"]);

        console.log(
            `✅ Host transpile complex: ${filenames.length} file(s), ` +
                `${result.imports.length} import(s), ${result.exports.length} export(s)`
        );
    });

    it("should produce substantially more content than type-only generation", async () => {
        const component = await buildComponentFromWit(TEST_WIT);
        const transpileResult = await transpileJsHost(component, { name: "test-world" });
        const typesResult = await generateJsBindings({ witContent: TEST_WIT }, "host");

        // Full transpilation produces JS runtime code, which is much larger
        const transpileSize = Object.values(transpileResult.files).reduce((sum, f) => sum + f.length, 0);
        const typesSize = Object.values(typesResult.files).reduce((sum, f) => sum + f.length, 0);

        expect(transpileSize).toBeGreaterThan(typesSize);

        console.log(`✅ Transpile size: ${transpileSize} bytes vs types-only: ${typesSize} bytes`);
    });

    it("should transpile from a .wasm file path", async () => {
        const component = await buildComponentFromWit(TEST_WIT);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wit-idl-transpile-"));
        const wasmFile = path.join(tmpDir, "test-world.wasm");
        fs.writeFileSync(wasmFile, component);

        try {
            const result = await transpileJsHostFromPath(wasmFile);

            expect(result.files).toBeDefined();
            const filenames = Object.keys(result.files);
            expect(filenames.length).toBeGreaterThan(0);

            const hasJs = filenames.some((f) => f.endsWith(".js") || f.endsWith(".mjs"));
            expect(hasJs).toBe(true);

            // Name should be derived from filename
            const mainJs = filenames.find((f) => f.endsWith(".js") || f.endsWith(".mjs"));
            expect(mainJs).toContain("test-world");

            console.log(`✅ Host transpile from path: Generated ${filenames.length} file(s)`);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("should use custom name when provided", async () => {
        const component = await buildComponentFromWit(TEST_WIT);
        const result = await transpileJsHost(component, { name: "my-custom-name" });

        const filenames = Object.keys(result.files);
        const mainJs = filenames.find((f) => f.endsWith(".js") || f.endsWith(".mjs"));
        expect(mainJs).toContain("my-custom-name");
    });

    it("should default name to 'component' when no name given", async () => {
        const component = await buildComponentFromWit(TEST_WIT);
        const result = await transpileJsHost(component);

        const filenames = Object.keys(result.files);
        const mainJs = filenames.find((f) => f.endsWith(".js") || f.endsWith(".mjs"));
        expect(mainJs).toContain("component");
    });

    it("should reject invalid wasm bytes", async () => {
        const badBytes = new Uint8Array([0, 1, 2, 3]);
        await expect(transpileJsHost(badBytes)).rejects.toThrow();
    });
});
