// ESBuild configuration for building the VSCode extension
// Dynamically discovers and bundles WASM resources and worker files from dependencies
// See: https://github.com/microsoft/vscode-extension-samples/blob/main/esbuild-sample/esbuild.js
//
// Key features:
// - Dynamic WASM resource discovery by analyzing bundle output for URL references
// - Dynamic worker file discovery through esbuild's import analysis + targeted entry points
// - Enhanced error handling with emoji-based logging
// - Constants for better maintainability
// - Safe file operations with proper error handling
// - Bundle analysis in development mode
// - Tree shaking and optimization
// - Modern Node.js target alignment with VS Code runtime

import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

// Constants for better maintainability
const WASM_EXTENSIONS = [".wasm"];
const BUILD_TARGET = "node22";
const ENTRY_POINT = "src/extension.ts";

/**
 * Options for the copyFiles utility function
 */
interface CopyFilesOptions {
    srcDir: string;
    destDir: string;
    files: string[] | string;
    logPrefix?: string;
    skipIfExists?: boolean;
    warnIfMissing?: boolean;
}

/**
 * Parsed information from a package.json file
 */
interface PackageInfo {
    name: string;
    version: string;
    files: string[];
    dependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    optionalDependencies: Record<string, string>;
}

/**
 * Safely reads a directory and returns files or empty array on error
 * @param {string} dirPath - Directory path to read
 * @returns {string[]} Array of filenames or empty array
 */
function safeReadDir(dirPath: string): string[] {
    try {
        return fs.readdirSync(dirPath);
    } catch (error) {
        console.warn(`⚠️  Could not read directory ${dirPath}: ${(error as Error).message}`);
        return [];
    }
}

/**
 * Safely checks if a path exists
 * @param {string} filePath - Path to check
 * @returns {boolean} True if path exists
 */
function safeExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        console.warn(`⚠️  Could not check existence of ${filePath}: ${(error as Error).message}`);
        return false;
    }
}

/**
 * Clean the dist directory before building
 * @param {string} distPath - Path to the dist directory
 */
function cleanDistDirectory(distPath: string): void {
    if (safeExists(distPath)) {
        try {
            fs.rmSync(distPath, { recursive: true, force: true });
            console.log("🧹 Cleaned dist directory");
        } catch (error) {
            console.warn(`⚠️  Could not clean dist directory: ${(error as Error).message}`);
        }
    }
}

/**
 * Generic function to copy files from source to destination with improved error handling
 * @param {Object} options - Copy options
 * @param {string} options.srcDir - Source directory path
 * @param {string} options.destDir - Destination directory path
 * @param {string[]|string} [options.files] - Specific files to copy, or extension filter (e.g., '.wasm')
 * @param {string} [options.logPrefix] - Prefix for log messages
 * @param {boolean} [options.skipIfExists] - Skip copying if destination file already exists
 * @param {boolean} [options.warnIfMissing] - Log warning if source file doesn't exist
 * @returns {number} Number of files successfully copied
 */
function copyFiles(options: CopyFilesOptions): number {
    const { srcDir, destDir, files, logPrefix = "", skipIfExists = false, warnIfMissing = true } = options;

    if (!safeExists(srcDir)) {
        if (warnIfMissing) {
            console.warn(`⚠️  Source directory ${srcDir} not found`);
        }
        return 0;
    }

    // Ensure destination directory exists
    try {
        fs.mkdirSync(destDir, { recursive: true });
    } catch (error) {
        console.error(`❌ Failed to create destination directory ${destDir}: ${(error as Error).message}`);
        return 0;
    }

    let filesToCopy;
    let copiedCount = 0;

    try {
        if (Array.isArray(files)) {
            // Copy specific files
            filesToCopy = files;
        } else if (typeof files === "string" && files.startsWith(".")) {
            // Copy all files with specific extension
            filesToCopy = safeReadDir(srcDir).filter((file) => file.endsWith(files));
        } else {
            throw new Error("files parameter must be an array of filenames or a file extension string");
        }

        filesToCopy.forEach((file) => {
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);

            if (!safeExists(srcPath)) {
                if (warnIfMissing) {
                    console.warn(`⚠️  ${srcPath} not found`);
                }
                return;
            }

            if (skipIfExists && safeExists(destPath)) {
                return;
            }

            try {
                fs.copyFileSync(srcPath, destPath);
                console.log(`✅ Copied ${file}${logPrefix ? ` ${logPrefix}` : ""} to ${path.basename(destDir)}/`);
                copiedCount++;
            } catch (error) {
                console.error(`❌ Failed to copy ${file}: ${(error as Error).message}`);
            }
        });
    } catch (error) {
        console.error(`❌ Error processing files in ${srcDir}: ${(error as Error).message}`);
    }

    return copiedCount;
}

/**
 * Read package.json dependencies to determine what WASM files need to be copied
 * @param {string} packagePath - Path to the package directory
 * @returns {Object} Package information including files to copy
 */
function readPackageInfo(packagePath: string): PackageInfo | null {
    const packageJsonPath = path.join(packagePath, "package.json");

    if (!safeExists(packageJsonPath)) {
        return null;
    }

    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;
        const filesSection = (packageJson.files as string[]) || [];

        return {
            name: packageJson.name as string,
            version: packageJson.version as string,
            files: filesSection,
            dependencies: (packageJson.dependencies as Record<string, string>) || {},
            peerDependencies: (packageJson.peerDependencies as Record<string, string>) || {},
            optionalDependencies: (packageJson.optionalDependencies as Record<string, string>) || {},
        };
    } catch (error) {
        console.warn(`Warning: Could not read package.json at ${packageJsonPath}: ${(error as Error).message}`);
        return null;
    }
}

/**
 * Get WASM files from a directory based on package files specification
 * @param {string} packageDir - Package directory path
 * @param {string[]} filesSpec - Files specification from package.json
 * @param {string} subDir - Subdirectory to check (e.g., 'lib', 'obj')
 * @returns {string[]} Array of WASM files found
 */
function getWasmFilesFromPackage(packageDir: string, filesSpec: string[], subDir: string): string[] {
    const targetDir = path.join(packageDir, subDir);

    if (!safeExists(targetDir)) {
        return [];
    }

    try {
        const allFiles = safeReadDir(targetDir);
        const wasmFiles = allFiles.filter((file) => WASM_EXTENSIONS.some((ext) => file.endsWith(ext)));

        // If package has files specification, filter based on that
        if (filesSpec && filesSpec.length > 0) {
            const relevantSpecs = filesSpec.filter(
                (spec: string) => spec.includes(subDir) && (spec.includes("*.wasm") || spec.includes("*.core*.wasm"))
            );

            if (relevantSpecs.length > 0) {
                // Use the files specification to determine which files to include
                return wasmFiles.filter((file) => {
                    return relevantSpecs.some((spec: string) => {
                        if (spec.includes("*.core*.wasm")) {
                            return file.includes(".core") && file.endsWith(".wasm");
                        }
                        if (spec.includes("*.wasm")) {
                            return true; // Include all WASM files
                        }
                        return false;
                    });
                });
            }
        }

        // Default: return all WASM files
        return wasmFiles;
    } catch (error) {
        console.warn(`⚠️  Could not read directory ${targetDir}: ${(error as Error).message}`);
        return [];
    }
}

/**
 * Extract directories from package.json "files" section that might contain WASM files
 * @param {string[]|undefined} filesSpec - Files specification from package.json
 * @returns {string[]} Array of directory names to search for WASM files
 */
function getWasmDirectoriesFromFiles(filesSpec: string[] | undefined): string[] {
    if (!filesSpec || !Array.isArray(filesSpec)) {
        // Fallback to standard directories if no files specification
        return [];
    }

    const directories = new Set<string>();

    filesSpec.forEach((filePattern) => {
        if (typeof filePattern === "string") {
            const parts = filePattern.split("/");
            const baseDir = parts[0];

            // Only include directories that might contain WASM files
            if (baseDir && filePattern.includes(".wasm")) {
                directories.add(baseDir);
            }
        }
    });

    // Convert Set to Array and add fallback directories if none found
    const result = Array.from(directories);
    if (result.length === 0) {
        return [];
    }

    return result;
}

/**
 * Convert package name to directory path in node_modules
 * @param {string} packageName - Package name (e.g., "@bytecodealliance/jco")
 * @returns {string[]} Array of path segments for the package directory
 */
function packageNameToPath(packageName: string): string[] {
    return packageName.startsWith("@") ? packageName.split("/") : [packageName];
}

/**
 * Process a single package for WASM resources
 * @param {string} packageName - Name of the package to process
 * @param {string} packageDir - Directory path of the package
 * @param {string} distDir - Destination directory for copied files
 * @param {Set<string>} processedPaths - Set of already processed paths to avoid duplicates
 * @param {string} nodeModulesDir - Root node_modules directory
 * @param {boolean} [isNested=false] - Whether this is a nested dependency (affects file copying behavior)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function processPackageForWasm(
    packageName: string,
    packageDir: string,
    distDir: string,
    processedPaths: Set<string>,
    nodeModulesDir: string,
    isNested = false
): void {
    if (processedPaths.has(packageDir)) {
        return;
    }
    processedPaths.add(packageDir);

    const packageInfo = readPackageInfo(packageDir);
    if (!packageInfo) {
        return;
    }

    const nestedLabel = isNested ? " (nested)" : "";
    console.log(`Found ${packageInfo.name}@${packageInfo.version}${nestedLabel}`);

    // Get directories to search from package.json "files" section
    const wasmDirectories = getWasmDirectoriesFromFiles(packageInfo.files);

    // Process each directory that might contain WASM files
    wasmDirectories.forEach((dirName) => {
        const wasmFiles = getWasmFilesFromPackage(packageDir, packageInfo.files, dirName);
        if (wasmFiles.length > 0) {
            const logPrefix = isNested
                ? `from nested ${packageInfo.name}/${dirName}`
                : `from ${packageInfo.name}/${dirName}`;

            copyFiles({
                srcDir: path.join(packageDir, dirName),
                destDir: distDir,
                files: wasmFiles,
                logPrefix: logPrefix,
                skipIfExists: isNested,
                warnIfMissing: false,
            });
        }
    });

    // Process dependencies from this package's package.json that might contain WASM resources
    const allPackageDependencies = {
        ...packageInfo.dependencies,
        ...packageInfo.peerDependencies,
        ...packageInfo.optionalDependencies,
    };

    Object.keys(allPackageDependencies).forEach((depName) => {
        // First check if it's installed locally in this package's node_modules
        const depPath = packageNameToPath(depName);
        const localDepDir = path.join(packageDir, "node_modules", ...depPath);

        if (fs.existsSync(localDepDir)) {
            const depPackageInfo = readPackageInfo(localDepDir);
            if (depPackageInfo) {
                // For nested dependencies, use nested mode
                processPackageForWasm(depName, localDepDir, distDir, processedPaths, nodeModulesDir, true);
            }
        } else if (!isNested) {
            // Only check root node_modules for non-nested packages to avoid infinite recursion
            const rootDepDir = path.join(nodeModulesDir, ...depPath);
            if (fs.existsSync(rootDepDir) && !processedPaths.has(rootDepDir)) {
                const depPackageInfo = readPackageInfo(rootDepDir);
                if (depPackageInfo) {
                    processPackageForWasm(depName, rootDepDir, distDir, processedPaths, nodeModulesDir, false);
                }
            }
        }
    });
}

/**
 * Creates an esbuild plugin for comprehensive resource discovery and build management
 * @returns {import('esbuild').Plugin} An esbuild plugin
 */
function createResourceDiscoveryPlugin() {
    return {
        name: "resource-discovery",
        setup(build: esbuild.PluginBuild) {
            // Hook into the build start
            build.onStart(() => {
                console.log("🔨 [watch] build started");
            });

            // Hook into build end for comprehensive logging
            build.onEnd((result: esbuild.BuildResult) => {
                if (result.errors.length > 0) {
                    console.log("❌ Build completed with errors:");
                    result.errors.forEach(({ text, location }) => {
                        console.error(`   ✘ [ERROR] ${text}`);
                        if (location) {
                            console.error(`     ${location.file}:${location.line}:${location.column}:`);
                        }
                    });
                } else {
                    console.log("✅ Build completed successfully");
                }

                if (result.warnings.length > 0) {
                    console.log("⚠️  Build warnings:");
                    result.warnings.forEach(({ text, location }) => {
                        console.warn(`   ⚠️  [WARNING] ${text}`);
                        if (location) {
                            console.warn(`     ${location.file}:${location.line}:${location.column}:`);
                        }
                    });
                }

                console.log("🔨 [watch] build finished");
            });
        },
    };
}

/**
 * Creates an esbuild plugin for dynamic WASM file discovery and copying
 * This plugin analyzes the bundle output to find dynamic WASM references and ensures those files are copied
 * @returns {import('esbuild').Plugin} An esbuild plugin
 */
function createWasmDiscoveryPlugin() {
    const discoveredWasmFiles = new Set<string>();
    const nodeModulesDir = path.join(process.cwd(), "node_modules");
    const distDir = path.join(process.cwd(), "dist");

    return {
        name: "wasm-discovery",
        setup(build: esbuild.PluginBuild) {
            // Hook into build end to analyze the output and discover WASM references
            build.onEnd(async (result: esbuild.BuildResult) => {
                if (result.errors.length > 0) return;

                // Analyze the main bundle for dynamic WASM references
                const mainBundlePath = path.join(distDir, "extension.js");

                if (safeExists(mainBundlePath)) {
                    try {
                        const bundleContent = fs.readFileSync(mainBundlePath, "utf8");

                        // Find all dynamic WASM references using the unified regex utility
                        const wasmUrlRegex = createUrlRegex("wasm");
                        let match;

                        // Find all WASM file references
                        while ((match = wasmUrlRegex.exec(bundleContent)) !== null) {
                            const wasmFileName = match[1];
                            // Only add if it's a valid simple filename without path separators (for direct references)
                            // Normalize the filename and ensure it is not empty or malformed
                            const normalizedFileName = wasmFileName.trim();
                            const isValidFileName =
                                normalizedFileName !== "" &&
                                !normalizedFileName.includes("/") &&
                                !normalizedFileName.includes("\\") &&
                                /^[a-zA-Z0-9._-]+$/.test(normalizedFileName); // Allow alphanumeric, dots, underscores, and hyphens

                            if (isValidFileName) {
                                discoveredWasmFiles.add(normalizedFileName);
                            }
                        }

                        // Copy discovered WASM files
                        if (discoveredWasmFiles.size > 0) {
                            console.log(`🔍 Discovered ${discoveredWasmFiles.size} dynamic WASM references in bundle`);

                            for (const wasmFileName of discoveredWasmFiles) {
                                // Find this WASM file in node_modules
                                const foundPaths = await findWasmFileInNodeModules(wasmFileName, nodeModulesDir);

                                if (foundPaths.length > 0) {
                                    const srcPath = foundPaths[0]; // Use the first found path
                                    const destPath = path.join(distDir, wasmFileName);

                                    if (!safeExists(destPath)) {
                                        try {
                                            fs.copyFileSync(srcPath, destPath);
                                            console.log(`✅ Copied dynamically referenced WASM: ${wasmFileName}`);
                                        } catch (error) {
                                            console.error(
                                                `❌ Failed to copy ${wasmFileName}: ${(error as Error).message}`
                                            );
                                        }
                                    }
                                } else {
                                    console.warn(`⚠️  Could not find WASM file in node_modules: ${wasmFileName}`);
                                }
                            }
                        }
                    } catch (error) {
                        console.warn(`⚠️  Could not analyze bundle for WASM references: ${(error as Error).message}`);
                    }
                }
            });
        },
    };
}

/**
 * Find a WASM file in node_modules by searching all packages
 * @param {string} wasmFileName - Name of the WASM file to find
 * @param {string} nodeModulesDir - Path to node_modules directory
 * @returns {Promise<string[]>} Array of paths where the file was found
 */
async function findWasmFileInNodeModules(wasmFileName: string, nodeModulesDir: string): Promise<string[]> {
    const foundPaths = [];

    try {
        // Search through all packages in node_modules
        const packages = safeReadDir(nodeModulesDir);

        for (const packageName of packages) {
            const packageDir = path.join(nodeModulesDir, packageName);

            if (packageName.startsWith("@")) {
                // Handle scoped packages
                const scopedPackages = safeReadDir(packageDir);
                for (const scopedName of scopedPackages) {
                    const scopedPackageDir = path.join(packageDir, scopedName);
                    const found = await searchForWasmInPackage(scopedPackageDir, wasmFileName);
                    foundPaths.push(...found);
                }
            } else {
                // Handle regular packages
                const found = await searchForWasmInPackage(packageDir, wasmFileName);
                foundPaths.push(...found);
            }
        }
    } catch (error) {
        console.warn(`⚠️  Error searching for WASM file ${wasmFileName}: ${(error as Error).message}`);
    }

    return foundPaths;
}

/**
 * Search for a WASM file within a specific package directory
 * @param {string} packageDir - Package directory to search
 * @param {string} wasmFileName - WASM file name to find
 * @returns {Promise<string[]>} Array of paths where the file was found
 */
async function searchForWasmInPackage(packageDir: string, wasmFileName: string): Promise<string[]> {
    const foundPaths = [];

    // Common directories where WASM files might be located
    const searchDirs = ["obj", "lib", "dist", "build", "wasm", ""];

    for (const searchDir of searchDirs) {
        const searchPath = searchDir ? path.join(packageDir, searchDir) : packageDir;
        const wasmPath = path.join(searchPath, wasmFileName);

        if (safeExists(wasmPath)) {
            foundPaths.push(wasmPath);
        }
    }

    return foundPaths;
}

/**
 * Find a specific JavaScript file in node_modules by searching all packages
 * @param {string} fileName - Name of the JS file to find
 * @param {string} nodeModulesDir - Path to node_modules directory
 * @returns {string[]} Array of paths where the file was found
 */
async function findJsFileInNodeModules(fileName: string, nodeModulesDir: string): Promise<string[]> {
    const foundPaths = [];

    try {
        // Search through all packages in node_modules
        const packages = safeReadDir(nodeModulesDir);

        for (const packageName of packages) {
            const packageDir = path.join(nodeModulesDir, packageName);

            if (packageName.startsWith("@")) {
                // Handle scoped packages
                const scopedPackages = safeReadDir(packageDir);
                for (const scopedName of scopedPackages) {
                    const scopedPackageDir = path.join(packageDir, scopedName);
                    const found = await searchForJsInPackage(scopedPackageDir, fileName);
                    foundPaths.push(...found);
                }
            } else {
                // Handle regular packages
                const found = await searchForJsInPackage(packageDir, fileName);
                foundPaths.push(...found);
            }
        }
    } catch (error) {
        console.warn(`⚠️  Error searching for JS file ${fileName}: ${(error as Error).message}`);
    }

    return foundPaths;
}

/**
 * Search for a JavaScript file within a specific package directory
 * @param {string} packageDir - Package directory to search
 * @param {string} fileName - JS file name to find
 * @returns {Promise<string[]>} Array of paths where the file was found
 */
async function searchForJsInPackage(packageDir: string, fileName: string): Promise<string[]> {
    const foundPaths = [];

    // Common directories where JS files might be located
    const searchDirs = ["lib", "dist", "build", "src", ""];

    for (const searchDir of searchDirs) {
        const searchPath = searchDir ? path.join(packageDir, searchDir) : packageDir;

        if (safeExists(searchPath)) {
            // Search recursively for the file
            const found = await searchRecursively(searchPath, fileName);
            foundPaths.push(...found);
        }
    }

    return foundPaths;
}

/**
 * Recursively search for a file in a directory
 * @param {string} dir - Directory to search
 * @param {string} fileName - File name to find
 * @returns {Promise<string[]>} Array of paths where the file was found
 */
async function searchRecursively(dir: string, fileName: string): Promise<string[]> {
    const foundPaths = [];

    try {
        const entries = safeReadDir(dir);

        for (const entry of entries) {
            const fullPath = path.join(dir, entry);

            try {
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    // Recursively search subdirectories (limit depth to avoid infinite loops)
                    const depth = fullPath.split(path.sep).length - dir.split(path.sep).length;
                    if (depth < 3) {
                        // Limit recursion depth
                        const found = await searchRecursively(fullPath, fileName);
                        foundPaths.push(...found);
                    }
                } else if (stat.isFile() && entry === fileName) {
                    foundPaths.push(fullPath);
                }
            } catch {
                // Skip entries that can't be accessed
                continue;
            }
        }
    } catch {
        // Skip directories that can't be read
    }

    return foundPaths;
}

/**
 * Creates a regex pattern for matching new URL() patterns with specific file extensions
 * @param {string} extension - File extension to match (e.g., 'wasm', 'js')
 * @param {boolean} [requireImportMeta=false] - Whether to require import.meta.url in the pattern
 * @returns {RegExp} Compiled regex pattern with global flag
 */
function createUrlRegex(extension: string, requireImportMeta = false): RegExp {
    const importMetaPart = requireImportMeta ? "[^)]*import\\.meta\\.url" : "[^)]*";
    return new RegExp(`new URL\\(['"](?:\\.\\/)?([^'"]+\\.${extension})['"]${importMetaPart}\\)`, "g");
}

/**
 * Discover all entry points for the build (main extension + dynamically loaded workers)
 * @returns {Promise<string[]>} Array of entry point paths
 */
async function discoverEntryPoints() {
    const entryPoints = [ENTRY_POINT];
    const nodeModulesDir = path.join(process.cwd(), "node_modules");

    // First, do a preliminary build to discover worker file references
    console.log("🔍 Performing preliminary analysis to discover worker files...");

    try {
        // Create a temporary build to analyze for worker references
        const tempResult = await esbuild.build({
            entryPoints: [ENTRY_POINT],
            bundle: true,
            format: "esm",
            platform: "node",
            target: BUILD_TARGET,
            external: ["vscode"],
            write: false, // Don't write to disk
            logLevel: "silent",
        });

        if (tempResult.outputFiles && tempResult.outputFiles.length > 0) {
            const bundleContent = tempResult.outputFiles[0].text;

            // Find all dynamic JS worker file references using the unified regex utility
            const jsUrlRegex = createUrlRegex("js", true);
            let match;

            while ((match = jsUrlRegex.exec(bundleContent)) !== null) {
                const fileName = match[1];
                console.log(`🔍 Found dynamic worker reference: ${fileName}`);

                // Find this worker file in node_modules
                const foundPaths = await findJsFileInNodeModules(fileName, nodeModulesDir);

                if (foundPaths.length > 0) {
                    const workerPath = foundPaths[0]; // Use the first found path
                    entryPoints.push(workerPath);
                    console.log(`🔧 Added worker entry point: ${path.relative(process.cwd(), workerPath)}`);
                } else {
                    console.warn(`⚠️  Could not find worker file in node_modules: ${fileName}`);
                }
            }
        }
    } catch (error) {
        console.warn(`⚠️  Could not perform preliminary analysis: ${(error as Error).message}`);
        console.warn("🔄 Falling back to main entry point only");
    }

    return entryPoints;
}

async function main() {
    try {
        // Clean dist directory before building (except in watch mode)
        const distPath = path.join(process.cwd(), "dist");
        if (!watch) {
            cleanDistDirectory(distPath);
        }

        // Note: WASM resources are now discovered and copied dynamically by the WASM discovery plugin
        console.log("📦 Dynamic WASM and worker discovery enabled...");

        // Discover all entry points (extension + workers)
        const entryPoints = await discoverEntryPoints();

        // Create the resource discovery plugins
        const resourceDiscoveryPlugin = createResourceDiscoveryPlugin();
        const wasmDiscoveryPlugin = createWasmDiscoveryPlugin();

        const ctx = await esbuild.context({
            entryPoints: entryPoints,
            bundle: true,
            format: "esm",
            minify: production,
            sourcemap: !production,
            sourcesContent: false,
            platform: "node",
            target: BUILD_TARGET,
            outdir: "dist",
            entryNames: "[name]",
            external: ["vscode"],
            logLevel: "silent",
            plugins: [resourceDiscoveryPlugin, wasmDiscoveryPlugin],
            define: {
                // Define globals to prevent bundling issues
                "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development"),
            },
            // Add banner to ensure polyfills are loaded first
            banner: {
                js: "// VS Code Extension - ESM Node.js Environment\n",
            },
            // Improve tree shaking and dead code elimination
            treeShaking: true,
            // Enable metafile for analysis
            metafile: !production,
        });

        if (watch) {
            console.log("👀 Starting watch mode...");
            await ctx.watch();
        } else {
            console.log("🔨 Building...");
            const result = await ctx.rebuild();

            // Log metafile info in development
            if (!production && result.metafile) {
                const analysis = await esbuild.analyzeMetafile(result.metafile);
                console.log("📊 Bundle analysis:");
                console.log(analysis);
            }

            await ctx.dispose();
            console.log("✅ Build completed successfully");
        }
    } catch (error) {
        console.error("❌ Build failed:", error);
        throw error;
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
