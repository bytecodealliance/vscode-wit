#!/bin/bash

# Setup script for WebAssembly build tools

set -e

echo "Setting up WebAssembly build tools..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust first:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "   source ~/.cargo/env"
    exit 1
fi

echo "✅ Rust is installed: $(cargo --version)"

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "📦 Installing wasm-pack v0.13.1..."
    cargo install wasm-pack@0.13.1
else
    echo "✅ wasm-pack is already installed: $(wasm-pack --version)"
    # Check if the version is compatible (0.13.x)
    WASM_PACK_VERSION=$(wasm-pack --version | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
    if [[ ! "$WASM_PACK_VERSION" =~ ^0\.13\. ]]; then
        echo "⚠️  Warning: wasm-pack version $WASM_PACK_VERSION detected. This project is tested with v0.13.1"
        echo "   Consider running: cargo install wasm-pack@0.13.1"
    fi
fi

# Add wasm32 target if not present
echo "🎯 Adding wasm32-unknown-unknown target..."
rustup target add wasm32-unknown-unknown

echo "✅ WebAssembly build tools setup complete!"
echo ""
echo "You can now run:"
echo "  npm run build-wasm      # Build WASM in release mode"
echo "  npm run build-wasm-dev  # Build WASM in development mode"
echo "  npm run build           # Build the entire extension"
