/**
 * Navigator Polyfill Test
 *
 * This test ensures that the navigator global is properly handled in the
 * VS Code extension environment, addressing the Node.js 21+ navigator global
 * that can cause issues in VS Code extensions.
 *
 * See: https://code.visualstudio.com/updates/v1_101#_web-environment-detection
 */

import { describe, it, expect, beforeAll } from "vitest";

describe("Navigator Polyfill Test", () => {
    beforeAll(() => {
        // Simulate VS Code extension host environment
        process.env.VSCODE_PID = "12345";

        // Clear existing navigator to test our polyfill
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).navigator;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (global as any).navigator;

        // Load the polyfills by requiring them
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../src/node-polyfills.js");
    });

    it("should define navigator in VS Code extension host environment", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const navigator = (globalThis as any).navigator;
        expect(typeof navigator).toBe("object");
        expect(navigator).not.toBe(undefined);
        expect(navigator).not.toBe(null);
    });

    it("should have essential navigator properties", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const navigator = (globalThis as any).navigator;
        expect(typeof navigator.userAgent).toBe("string");
        expect(typeof navigator.platform).toBe("string");
        expect(typeof navigator.language).toBe("string");
        expect(Array.isArray(navigator.languages)).toBe(true);
        expect(typeof navigator.onLine).toBe("boolean");
    });

    it("should set appropriate values for VS Code extension host", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const navigator = (globalThis as any).navigator;
        // With navigator cleared, we should get our polyfill values
        expect(navigator.userAgent).toBe("VSCode-Extension-Host");
        expect(navigator.platform).toBe(process.platform);
        expect(navigator.onLine).toBe(true);
    });

    it("should also be available on global object", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalNavigator = (global as any).navigator;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalThisNavigator = (globalThis as any).navigator;
        expect(globalNavigator).toBeDefined();
        expect(globalNavigator).toBe(globalThisNavigator);
    });

    it("should keep other browser globals undefined", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const windowGlobal = (globalThis as any).window;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const documentGlobal = (globalThis as any).document;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const locationGlobal = (globalThis as any).location;

        expect(windowGlobal).toBe(undefined);
        expect(documentGlobal).toBe(undefined);
        expect(locationGlobal).toBe(undefined);
    });

    it("should make process and Buffer available globally", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalProcess = (globalThis as any).process;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalBuffer = (globalThis as any).Buffer;

        expect(globalProcess).toBe(process);
        expect(globalBuffer).toBe(Buffer);
    });
});
