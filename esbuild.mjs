// ESBuild configuration for building the VSCode extension (sample-based)
// See: https://github.com/microsoft/vscode-extension-samples/blob/main/esbuild-sample/esbuild.js

import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * Copy WASM and worker resources from node_modules to dist
 */
function copyWasmResources() {
    const distDir = path.join(process.cwd(), "dist");

    // Ensure dist directory exists
    fs.mkdirSync(distDir, { recursive: true });

    // Copy WASM files from @bytecodealliance/jco/lib
    const jcoLibDir = path.join(process.cwd(), "node_modules", "@bytecodealliance", "jco", "lib");
    const jcoLibFiles = ["wasi_snapshot_preview1.command.wasm", "wasi_snapshot_preview1.reactor.wasm"];

    jcoLibFiles.forEach((file) => {
        const srcPath = path.join(jcoLibDir, file);
        const destPath = path.join(distDir, file);

        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied ${file} to dist/`);
        } else {
            console.warn(`Warning: ${srcPath} not found`);
        }
    });

    // Copy all WASM files from jco/obj
    const jcoObjDir = path.join(process.cwd(), "node_modules", "@bytecodealliance", "jco", "obj");
    if (fs.existsSync(jcoObjDir)) {
        const objFiles = fs.readdirSync(jcoObjDir).filter((file) => file.endsWith(".wasm"));
        objFiles.forEach((file) => {
            const srcPath = path.join(jcoObjDir, file);
            const destPath = path.join(distDir, file);
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied ${file} to dist/`);
        });
    }

    // Copy WASM files from @bytecodealliance/componentize-js
    const componentizeJsLibDir = path.join(
        process.cwd(),
        "node_modules",
        "@bytecodealliance",
        "componentize-js",
        "lib"
    );

    const componentizeJsLibFiles = [
        "spidermonkey-embedding-splicer.core.wasm",
        "spidermonkey-embedding-splicer.core2.wasm",
        "starlingmonkey_embedding.wasm",
        "starlingmonkey_embedding.debug.wasm",
        "starlingmonkey_embedding_weval.wasm",
    ];

    componentizeJsLibFiles.forEach((file) => {
        const srcPath = path.join(componentizeJsLibDir, file);
        const destPath = path.join(distDir, file);

        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied ${file} to dist/`);
        } else {
            console.warn(`Warning: ${srcPath} not found`);
        }
    });

    // Also check nested componentize-js in jco
    const jcoNestedComponentizeJsLibDir = path.join(
        process.cwd(),
        "node_modules",
        "@bytecodealliance",
        "jco",
        "node_modules",
        "@bytecodealliance",
        "componentize-js",
        "lib"
    );

    if (fs.existsSync(jcoNestedComponentizeJsLibDir)) {
        componentizeJsLibFiles.forEach((file) => {
            const srcPath = path.join(jcoNestedComponentizeJsLibDir, file);
            const destPath = path.join(distDir, file);

            if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
                fs.copyFileSync(srcPath, destPath);
                console.log(`Copied ${file} from nested jco/componentize-js to dist/`);
            }
        });
    }

    // Copy files from @bytecodealliance/preview2-shim
    const preview2ShimDir = path.join(process.cwd(), "node_modules", "@bytecodealliance", "preview2-shim");

    if (fs.existsSync(preview2ShimDir)) {
        // Copy the main module files
        const shimFiles = ["lib", "src"];
        shimFiles.forEach((item) => {
            const srcPath = path.join(preview2ShimDir, item);
            const destPath = path.join(distDir, "preview2-shim", item);

            if (fs.existsSync(srcPath)) {
                // Create destination directory
                fs.mkdirSync(path.dirname(destPath), { recursive: true });

                if (fs.statSync(srcPath).isDirectory()) {
                    // Copy directory recursively
                    fs.cpSync(srcPath, destPath, { recursive: true });
                    console.log(`Copied ${item}/ from preview2-shim to dist/preview2-shim/`);
                } else {
                    // Copy file
                    fs.copyFileSync(srcPath, destPath);
                    console.log(`Copied ${item} from preview2-shim to dist/preview2-shim/`);
                }
            }
        });

        // Copy package.json for module resolution
        const packageJsonSrc = path.join(preview2ShimDir, "package.json");
        const packageJsonDest = path.join(distDir, "preview2-shim", "package.json");
        if (fs.existsSync(packageJsonSrc)) {
            fs.mkdirSync(path.dirname(packageJsonDest), { recursive: true });
            fs.copyFileSync(packageJsonSrc, packageJsonDest);
            console.log("Copied package.json from preview2-shim to dist/preview2-shim/");
        }
    }

    // Note: Worker files are bundled directly into dist/ to ensure proper module resolution
    // This prevents import errors when the extension tries to load worker threads at runtime
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: "esbuild-problem-matcher",
    setup(build) {
        build.onStart(() => {
            console.log("[watch] build started");
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                if (location) {
                    console.error(`    ${location.file}:${location.line}:${location.column}:`);
                }
            });
            console.log("[watch] build finished");
        });
    },
};

async function main() {
    // Copy WASM resources first
    console.log("Copying WASM resources...");
    copyWasmResources();

    // Find all worker files in preview2-shim
    const preview2ShimWorkerDir = path.join(
        process.cwd(),
        "node_modules",
        "@bytecodealliance",
        "preview2-shim",
        "lib",
        "io"
    );

    const workerEntryPoints = [];
    if (fs.existsSync(preview2ShimWorkerDir)) {
        const workerFiles = fs
            .readdirSync(preview2ShimWorkerDir)
            .filter((file) => file.startsWith("worker-") && file.endsWith(".js"))
            .map((file) => path.join(preview2ShimWorkerDir, file));
        workerEntryPoints.push(...workerFiles);
        console.log(
            `Found ${workerFiles.length} worker files to bundle:`,
            workerFiles.map((f) => path.basename(f))
        );
    }

    const ctx = await esbuild.context({
        entryPoints: ["src/extension.ts", ...workerEntryPoints],
        bundle: true,
        format: "esm",
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: "node",
        target: "node18",
        outdir: "dist",
        entryNames: "[name]",
        external: ["vscode"],
        logLevel: "silent",
        plugins: [esbuildProblemMatcherPlugin],
        inject: ["src/node-polyfills.js"],
        define: {
            // Define globals to prevent bundling issues
            "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development"),
        },
        // Add banner to ensure polyfills are loaded first
        banner: {
            js: "// VS Code Extension - ESM Node.js Environment\n",
        },
    });
    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
