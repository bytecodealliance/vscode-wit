/**
 * Node.js polyfills for VS Code extension environment (ESM)
 * Handles the navigator global that's now available in Node.js 21+
 * See: https://code.visualstudio.com/updates/v1_101#_web-environment-detection
 */

// Check if we're in a VS Code extension host environment
const isVSCodeExtensionHost =
    typeof globalThis.vscode !== "undefined" || (typeof process !== "undefined" && process.env.VSCODE_PID);

// Handle navigator global properly for VS Code extensions
if (isVSCodeExtensionHost) {
    // If navigator exists (Node.js 21+), we need to ensure it works in VS Code context
    if (typeof globalThis.navigator !== "undefined") {
        // Override specific properties that might cause issues in VS Code extension host
        const originalNavigator = globalThis.navigator;
        globalThis.navigator = {
            ...originalNavigator,
            userAgent: originalNavigator.userAgent || "VSCode-Extension-Host",
            platform: originalNavigator.platform || process.platform,
            language: originalNavigator.language || "en-US",
            languages: originalNavigator.languages || ["en-US"],
            onLine: originalNavigator.onLine !== undefined ? originalNavigator.onLine : true,
        };
    } else {
        // Define a minimal navigator object for older Node.js versions
        globalThis.navigator = {
            userAgent: "VSCode-Extension-Host",
            platform: process.platform,
            language: "en-US",
            languages: ["en-US"],
            onLine: true,
        };
    }

    // Also set on global for compatibility
    if (typeof global !== "undefined") {
        global.navigator = globalThis.navigator;
    }
}

// Ensure other browser globals are undefined to prevent confusion
if (typeof globalThis !== "undefined") {
    if (typeof globalThis.window === "undefined") {
        globalThis.window = undefined;
    }
    if (typeof globalThis.document === "undefined") {
        globalThis.document = undefined;
    }
    if (typeof globalThis.location === "undefined") {
        globalThis.location = undefined;
    }
}

// Ensure process and Buffer are available globally for dependencies that expect them
if (typeof globalThis.process === "undefined" && typeof process !== "undefined") {
    globalThis.process = process;
}

if (typeof globalThis.Buffer === "undefined" && typeof Buffer !== "undefined") {
    globalThis.Buffer = Buffer;
}
