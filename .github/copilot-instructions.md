## AI coding agent guide for this repo (vscode-wit)

Purpose: VS Code extension that adds WIT (WebAssembly Interface Types) language support plus validation, binding generation via wit-bindgen, and WIT extraction from .wasm components.

Big picture architecture
- Extension entry: `src/extension.ts` (registers commands, completions, context keys). Keep new commands registered in `package.json.contributes.commands` and push disposables to `context.subscriptions`.
- Validation: `src/validator.ts` calls `validateWitSyntaxDetailedFromWasm` from `src/wasmUtils.ts`, parses errors with `src/errorParser.ts`, and writes VS Code diagnostics. Prefer Problems pane over popups.
- WASM integration: `src/wasmUtils.ts` lazy-loads local package `wit-bindgen-wasm` and initializes its wasm binary. Primary APIs: `getWitBindgenVersionFromWasm`, `validateWitSyntaxDetailedFromWasm`, `generateBindingsFromWasm` (returns JSON map of files with latin1-encoded content).
- Grammar/snippets: `syntaxes/wit.tmLanguage.json`, `snippets.json` (Language id: `wit`, scope: `source.wit`).
- Rust subproject: `wit-bindgen-wasm/` builds a wasm-pack package consumed at runtime (`wit_bindgen_wasm_bg.wasm`).

Build and dev workflows
- One-time setup (requires Rust + cargo): `npm run setup-wasm` (installs wasm-pack 0.13.1 and wasm32 target).
- Dev watch: `npm run dev` (parallel: `gen-watch` for d.ts, `build-extension-watch` for esbuild).
- Full build: `npm run build` (build wasm via wasm-pack, then bundle the extension with esbuild).
- Pack/install locally: `npm run package` then `npm run install-extension` (uses `vsce` and `code --install-extension`).
- Tests: `npm test` runs lint, prettier check, build, package, grammar tests, and unit tests. Quick loops: `npm run test-unit` or `npm run test-grammar`. Update grammar snapshots: `npm run update-snapshot`.

Bundling details (esbuild.mjs)
- ESM build targeting Node 22 with `external: ["vscode"]`, injects `src/node-polyfills.js`.
- Plugins auto-discover and copy dynamic WASM references and worker JS to `dist/`. `src/wasmUtils.ts` first looks for `dist/wit_bindgen_wasm_bg.wasm` and falls back to module default init. If you introduce new wasm or worker assets referenced via `new URL('file.ext', import.meta.url)`, the plugin will attempt to copy them.

Runtime behaviors and contracts
- Extract WIT from components: command `wit-idl.extractWit` shells out to `wasm-tools component wit <file.wasm>`; ensure `wasm-tools` is on PATH. Enablement uses a context key set when active editor is a `.wasm` with component version 0x0A.
- Binding generation: `generateBindingsFromWasm` returns a JSON map of filename -> content (latin1). When writing to disk, create buffers via `Buffer.from(content, 'latin1')`. See usage in `src/extension.ts`.
- Diagnostics: use `WitSyntaxValidator.createDiagnosticFromError` and keep `diagnostic.source` consistent (`wit-syntax` or `wit-bindgen`). Workspace validation streams progress via `withProgress` and writes a dedicated output channel.

Coding conventions specific to this repo
- ESM TypeScript: use explicit `.js` extensions in relative imports (e.g., `import { X } from './validator.js'`). Keep explicit param/return types; avoid `any`.
- File layout: implementation in `src/`, tests in `tests/` (Vitest), grammar tests under `tests/grammar/**`. Type declarations generated to `types/` by `npm run gen-types`.
- VS Code contributions: update `package.json` for languages, grammars, snippets, menus, keybindings, and new commands. Match command IDs with registrations in `extension.ts`.

Adding a feature safely
- Register a command in `package.json` and implement it in `src/extension.ts`; push to `context.subscriptions`.
- If it relies on `wit-bindgen-wasm`, add a thin wrapper in `src/wasmUtils.ts` and write unit tests in `tests/` (Vitest). Use Problems pane diagnostics over modal errors.
- If you need WIT extraction or inspection, prefer `wasm-tools` CLI calls (as in `extractWitWithWasmTools`).

Common pitfalls and fixes
- “Failed to initialize WIT bindgen WASM module”: ensure `npm run build` copied `wit_bindgen_wasm_bg.wasm` to `dist/` or run `npm run setup-wasm && npm run build-wasm`.
- “wasm-tools not found” when extracting WIT: install wasm-tools and ensure PATH is set for the VS Code environment.

Key references
- Additional instructions: `.github/instructions/*`
- Entry point: `src/extension.ts`
- Validation: `src/validator.ts`, `src/errorParser.ts`, `src/wasmUtils.ts`
- Build: `esbuild.mjs`, `package.json` scripts
- WASM package: `wit-bindgen-wasm/README.md`, `wit-bindgen-wasm/pkg/*`
