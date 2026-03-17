#!/bin/bash

# Setup script for WebAssembly Component Model build tools

set -e

echo "Setting up WebAssembly Component Model build tools..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust first:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "   source ~/.cargo/env"
    exit 1
fi

echo "✅ Rust is installed: $(cargo --version)"

# Check if correct version of wasm-tools is installed
WASM_TOOLS_VERSION="1.245.0"
if command -v wasm-tools &> /dev/null; then
    INSTALLED_VERSION=$(wasm-tools --version | awk '{print $2}')
    if [[ "$INSTALLED_VERSION" == "$WASM_TOOLS_VERSION" ]]; then
        echo "✅ wasm-tools is installed: $(wasm-tools --version)"
    else
        echo "📦 Updating wasm-tools from $INSTALLED_VERSION to $WASM_TOOLS_VERSION..."
        cargo install wasm-tools@"$WASM_TOOLS_VERSION"
    fi
else
    echo "📦 Installing wasm-tools $WASM_TOOLS_VERSION..."
    cargo install wasm-tools@"$WASM_TOOLS_VERSION"
fi

# Add wasm32 target if not present
echo "🎯 Adding wasm32-unknown-unknown target..."
rustup target add wasm32-unknown-unknown

# Check if jco is available via npx
echo "🔍 Checking jco availability..."
if npx jco --version &> /dev/null; then
    echo "✅ jco is available: $(npx jco --version)"
else
    echo "⚠️  jco not found. Install it with: npm install @bytecodealliance/jco"
    echo "   (It should be in the project's devDependencies)"
fi

echo ""
echo "✅ WebAssembly Component Model build tools setup complete!"
echo ""
echo "You can now run:"
echo "  npm run build-wasm      # Build WASM component"
echo "  npm run build            # Build the entire extension"
