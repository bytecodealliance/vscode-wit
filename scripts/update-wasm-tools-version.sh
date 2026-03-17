#!/bin/bash

# Syncs the wasm-tools CLI version with the wit-component crate version in Cargo.toml,
# installs the matching wasm-tools version, and updates setup-wasm.sh.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CARGO_TOML="$PROJECT_DIR/wit-bindgen-wasm/Cargo.toml"
SETUP_SCRIPT="$SCRIPT_DIR/setup-wasm.sh"

# Extract wit-component version from Cargo.toml (e.g., "0.245")
set +e
WIT_COMPONENT_VERSION=$(grep -E 'wit-component\s*=\s*"[^"]+"' "$CARGO_TOML" | sed -E 's/.*"([^"]+)".*/\1/')
set -e

if [ -z "$WIT_COMPONENT_VERSION" ]; then
    echo "❌ Could not find wit-component version in $CARGO_TOML"
    exit 1
fi

# Convert crate version 0.X to CLI version 1.X (e.g., 0.245 -> 1.245.0)
MINOR=$(echo "$WIT_COMPONENT_VERSION" | sed 's/^0\.//')
WASM_TOOLS_VERSION="1.${MINOR}.0"

echo "📦 wit-component crate version: $WIT_COMPONENT_VERSION"
echo "🔧 Matching wasm-tools CLI version: $WASM_TOOLS_VERSION"

# Install the matching wasm-tools version
echo "📥 Installing wasm-tools $WASM_TOOLS_VERSION..."
cargo install "wasm-tools@${WASM_TOOLS_VERSION}"

# Update the pinned version in setup-wasm.sh using a portable approach
if command -v perl &> /dev/null; then
    perl -i -pe "s/WASM_TOOLS_VERSION=\"[^\"]*\"/WASM_TOOLS_VERSION=\"${WASM_TOOLS_VERSION}\"/" "$SETUP_SCRIPT"
else
    # Fallback: use temp file for maximum portability
    sed "s/WASM_TOOLS_VERSION=\"[^\"]*\"/WASM_TOOLS_VERSION=\"${WASM_TOOLS_VERSION}\"/" "$SETUP_SCRIPT" > "$SETUP_SCRIPT.tmp"
    mv "$SETUP_SCRIPT.tmp" "$SETUP_SCRIPT"
fi
echo "✅ Updated WASM_TOOLS_VERSION in setup-wasm.sh to $WASM_TOOLS_VERSION"
