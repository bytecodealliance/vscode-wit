import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

type Command = { command: string };
type MenuItem = { command?: string; when?: string };
type Contributes = {
    commands: Command[];
    menus: Record<string, MenuItem[]> & { commandPalette: MenuItem[] };
};

describe("command contributions", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as unknown as {
        contributes: Contributes;
    };

    it("includes Extract Core Wasm command", () => {
        const commands: Command[] = pkg.contributes.commands;
        expect(commands.some((c) => c.command === "wit-idl.extractCoreWasm")).toBe(true);
    });

    it("shows Extract Core Wasm in explorer and editor context menus for wasm components", () => {
        const menus = pkg.contributes.menus;
        const hasInEditor = (menus["editor/context"] || []).some(
            (m: MenuItem) =>
                m.command === "wit-idl.extractCoreWasm" && !!m.when && /witIdl\.isWasmComponent/.test(m.when)
        );
        const hasInExplorer = (menus["explorer/context"] || []).some(
            (m: MenuItem) =>
                m.command === "wit-idl.extractCoreWasm" && !!m.when && /witIdl\.isWasmComponent/.test(m.when)
        );
        expect(hasInEditor).toBe(true);
        expect(hasInExplorer).toBe(true);
    });

    it("shows Extract Core Wasm in command palette when component is active", () => {
        const palette: MenuItem[] = pkg.contributes.menus.commandPalette;
        const entry = palette.find((m: MenuItem) => m.command === "wit-idl.extractCoreWasm");
        expect(entry).toBeTruthy();
        expect(entry && entry.when ? /witIdl\.isWasmComponent/.test(entry.when) : false).toBe(true);
    });
});
