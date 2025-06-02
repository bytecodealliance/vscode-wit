/**
 * Build Resources Copy Test
 *
 * This test ensures that all required WASM files from the @bytecodealliance dependencies
 * are properly copied to the dist directory during the build process. The extension relies
 * on these WASM files for WIT validation and compilation functionality.
 *
 * Worker files are intentionally left in node_modules to maintain proper import resolution
 * and dependency chains.
 *
 * The test verifies:
 * - All required WASM files from @bytecodealliance/jco are copied to dist/
 * - All required WASM files from @bytecodealliance/componentize-js are copied to dist/
 * - Directory structure is properly created
 * - File integrity (size matching) between source and destination
 * - Comprehensive detection of all WASM files in dependencies
 *
 * Run this test after any changes to the build configuration to ensure resources
 * are properly bundled.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Build Resources Copy Test", () => {
    const distDir = path.join(__dirname, "..", "dist");
    const nodeModulesDir = path.join(__dirname, "..", "node_modules");

    beforeAll(() => {
        // Ensure dist directory exists
        expect(fs.existsSync(distDir)).toBe(true);
    });

    describe("WASM files from @bytecodealliance/jco", () => {
        const jcoLibDir = path.join(nodeModulesDir, "@bytecodealliance", "jco", "lib");
        const jcoObjDir = path.join(nodeModulesDir, "@bytecodealliance", "jco", "obj");

        const requiredJcoWasmFiles = ["wasi_snapshot_preview1.command.wasm", "wasi_snapshot_preview1.reactor.wasm"];

        const requiredJcoObjFiles = [
            "js-component-bindgen-component.core.wasm",
            "js-component-bindgen-component.core2.wasm",
            "js-component-bindgen-component.wasm",
        ];

        requiredJcoWasmFiles.forEach((wasmFile) => {
            it(`should copy ${wasmFile} from jco/lib to dist`, () => {
                const sourcePath = path.join(jcoLibDir, wasmFile);
                const destPath = path.join(distDir, wasmFile);

                // Check if source exists
                expect(fs.existsSync(sourcePath)).toBe(true);

                // Check if destination exists
                expect(fs.existsSync(destPath)).toBe(true);

                // Check if files have same size (basic integrity check)
                const sourceStats = fs.statSync(sourcePath);
                const destStats = fs.statSync(destPath);
                expect(destStats.size).toBe(sourceStats.size);
            });
        });

        requiredJcoObjFiles.forEach((wasmFile) => {
            it(`should copy ${wasmFile} from jco/obj to dist (if exists)`, () => {
                const sourcePath = path.join(jcoObjDir, wasmFile);

                // Only test if source file exists
                if (fs.existsSync(sourcePath)) {
                    const destPath = path.join(distDir, wasmFile);

                    // Check if destination exists
                    expect(fs.existsSync(destPath)).toBe(true);

                    // Check if files have same size (basic integrity check)
                    const sourceStats = fs.statSync(sourcePath);
                    const destStats = fs.statSync(destPath);
                    expect(destStats.size).toBe(sourceStats.size);
                }
            });
        });
    });

    describe("WASM files from @bytecodealliance/componentize-js", () => {
        const componentizeJsLibDir = path.join(nodeModulesDir, "@bytecodealliance", "componentize-js", "lib");

        const requiredComponentizeJsWasmFiles = [
            "spidermonkey-embedding-splicer.core.wasm",
            "spidermonkey-embedding-splicer.core2.wasm",
            "starlingmonkey_embedding.wasm",
            "starlingmonkey_embedding.debug.wasm",
            "starlingmonkey_embedding_weval.wasm",
        ];

        requiredComponentizeJsWasmFiles.forEach((wasmFile) => {
            it(`should copy ${wasmFile} from componentize-js/lib to dist`, () => {
                const sourcePath = path.join(componentizeJsLibDir, wasmFile);
                const destPath = path.join(distDir, wasmFile);

                // Check if source exists
                expect(fs.existsSync(sourcePath)).toBe(true);

                // Check if destination exists
                expect(fs.existsSync(destPath)).toBe(true);

                // Check if files have same size (basic integrity check)
                const sourceStats = fs.statSync(sourcePath);
                const destStats = fs.statSync(destPath);
                expect(destStats.size).toBe(sourceStats.size);
            });
        });
    });

    describe("Required directory structure", () => {
        it("should have dist directory", () => {
            expect(fs.existsSync(distDir)).toBe(true);
            expect(fs.statSync(distDir).isDirectory()).toBe(true);
        });
    });

    describe("Extension bundle integrity", () => {
        it("should have main extension.js file", () => {
            const extensionPath = path.join(distDir, "extension.js");
            expect(fs.existsSync(extensionPath)).toBe(true);

            // Ensure it's not empty
            const stats = fs.statSync(extensionPath);
            expect(stats.size).toBeGreaterThan(0);
        });

        it("should have source map if in development mode", () => {
            const sourceMapPath = path.join(distDir, "extension.js.map");
            // Source map should exist in development builds
            if (fs.existsSync(sourceMapPath)) {
                const stats = fs.statSync(sourceMapPath);
                expect(stats.size).toBeGreaterThan(0);
            }
        });
    });

    describe("Runtime resource accessibility", () => {
        it("should be able to resolve WASM file paths at runtime", () => {
            // Check that we can find at least some WASM files directly in dist
            const wasmFiles = fs.readdirSync(distDir).filter((file) => file.endsWith(".wasm"));
            expect(wasmFiles.length).toBeGreaterThan(0);
        });
    });

    describe("Comprehensive WASM file detection", () => {
        it("should copy all WASM files found in bytecodealliance dependencies", () => {
            // Find all WASM files in source dependencies
            const sourceWasmFiles: Array<{ source: string; expectedDest: string; type: string }> = [];

            // Check @bytecodealliance/jco/lib for WASM files
            const jcoLibDir = path.join(nodeModulesDir, "@bytecodealliance", "jco", "lib");
            if (fs.existsSync(jcoLibDir)) {
                const jcoLibWasmFiles = fs.readdirSync(jcoLibDir).filter((file) => file.endsWith(".wasm"));
                jcoLibWasmFiles.forEach((file) => {
                    sourceWasmFiles.push({
                        source: path.join(jcoLibDir, file),
                        expectedDest: path.join(distDir, file),
                        type: "WASM",
                    });
                });
            }

            // Check @bytecodealliance/jco/obj for WASM files
            const jcoObjDir = path.join(nodeModulesDir, "@bytecodealliance", "jco", "obj");
            if (fs.existsSync(jcoObjDir)) {
                const jcoObjWasmFiles = fs.readdirSync(jcoObjDir).filter((file) => file.endsWith(".wasm"));
                jcoObjWasmFiles.forEach((file) => {
                    sourceWasmFiles.push({
                        source: path.join(jcoObjDir, file),
                        expectedDest: path.join(distDir, file),
                        type: "WASM",
                    });
                });
            }

            // Check @bytecodealliance/componentize-js/lib for WASM files
            const componentizeJsLibDir = path.join(nodeModulesDir, "@bytecodealliance", "componentize-js", "lib");
            if (fs.existsSync(componentizeJsLibDir)) {
                const componentizeJsWasmFiles = fs
                    .readdirSync(componentizeJsLibDir)
                    .filter((file) => file.endsWith(".wasm"));
                componentizeJsWasmFiles.forEach((file) => {
                    sourceWasmFiles.push({
                        source: path.join(componentizeJsLibDir, file),
                        expectedDest: path.join(distDir, file),
                        type: "WASM",
                    });
                });
            }

            // Ensure we found some WASM files to test
            expect(sourceWasmFiles.length).toBeGreaterThan(0);

            // Check each WASM file is copied correctly
            sourceWasmFiles.forEach(({ source, expectedDest, type }) => {
                const fileName = path.basename(source);

                // Source should exist
                expect(fs.existsSync(source)).toBe(true);

                // Destination should exist
                expect(fs.existsSync(expectedDest)).toBe(true);

                // Files should have same size
                const sourceStats = fs.statSync(source);
                const destStats = fs.statSync(expectedDest);
                expect(destStats.size).toBe(sourceStats.size);
            });

            const wasmCount = sourceWasmFiles.filter((f) => f.type === "WASM").length;
            console.log(`✓ Verified ${wasmCount} WASM files are properly copied to dist/`);
        });
    });
});
