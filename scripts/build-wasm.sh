#!/bin/bash

# Build WebAssembly component from Rust source
# Uses: cargo (Rust), wasm-tools (component model), jco (JS transpilation)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WASM_DIR="$PROJECT_DIR/wit-bindgen-wasm"
PKG_DIR="$WASM_DIR/pkg"
TARGET_DIR="$WASM_DIR/target"

# Parse arguments
RELEASE_FLAG=""
CARGO_PROFILE="debug"
if [[ "$1" == "--release" ]]; then
    RELEASE_FLAG="--release"
    CARGO_PROFILE="release"
fi

echo "🔨 Building WebAssembly component..."

# Step 1: Build the Rust code to a core WASM module
echo "📦 Step 1/4: Compiling Rust to WebAssembly..."
cd "$WASM_DIR"
cargo build --target wasm32-unknown-unknown $RELEASE_FLAG

CORE_WASM="$TARGET_DIR/wasm32-unknown-unknown/$CARGO_PROFILE/wit_bindgen_wasm.wasm"
if [ ! -f "$CORE_WASM" ]; then
    echo "❌ Core WASM not found at: $CORE_WASM"
    exit 1
fi
echo "   Core module: $(du -h "$CORE_WASM" | cut -f1)"

# Step 2: Embed WIT metadata into the core module
echo "🔗 Step 2/4: Embedding WIT component type information..."
EMBEDDED_WASM="$TARGET_DIR/wit_bindgen_wasm.embedded.wasm"
wasm-tools component embed wit/ "$CORE_WASM" --world wit-bindgen-wasm -o "$EMBEDDED_WASM"

# Step 3: Create the WebAssembly component
echo "🧩 Step 3/4: Creating WebAssembly component..."
COMPONENT_WASM="$TARGET_DIR/wit_bindgen_wasm.component.wasm"
wasm-tools component new "$EMBEDDED_WASM" -o "$COMPONENT_WASM"
echo "   Component: $(du -h "$COMPONENT_WASM" | cut -f1)"

# Step 4: Transpile to JavaScript using jco
echo "🔄 Step 4/4: Transpiling component to JavaScript..."
mkdir -p "$PKG_DIR/interfaces"

# Clean old generated files (preserve package.json)
find "$PKG_DIR" -name "*.js" -o -name "*.d.ts" -o -name "*.wasm" | xargs rm -f 2>/dev/null || true
rm -rf "$PKG_DIR/interfaces/"

npx jco transpile "$COMPONENT_WASM" -o "$PKG_DIR" --name wit_bindgen_wasm

# Ensure package.json exists for npm resolution
cat > "$PKG_DIR/package.json" << 'PKGJSON'
{
  "name": "wit-bindgen-wasm",
  "type": "module",
  "description": "WebAssembly component wrapper for wit-bindgen",
  "version": "0.1.0",
  "license": "Apache-2.0 WITH LLVM-exception",
  "files": [
    "wit_bindgen_wasm.core.wasm",
    "wit_bindgen_wasm.js",
    "wit_bindgen_wasm.d.ts",
    "interfaces/"
  ],
  "main": "wit_bindgen_wasm.js",
  "types": "wit_bindgen_wasm.d.ts"
}
PKGJSON

echo ""
echo "✅ WebAssembly component build complete!"
echo "   Output: $PKG_DIR/"
ls -la "$PKG_DIR/"
