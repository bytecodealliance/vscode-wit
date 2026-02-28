#!/bin/bash
set -euo pipefail

# Build all sample WebAssembly components
# Usage: ./build.sh [--release]
#
# Prerequisites:
#   rustup target add wasm32-wasip2
#   cargo install wasm-tools   (optional, for inspection)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PROFILE="debug"
CARGO_FLAGS=""
if [[ "${1:-}" == "--release" ]]; then
    PROFILE="release"
    CARGO_FLAGS="--release"
fi

echo "=== Building sample WebAssembly components ($PROFILE) ==="
echo ""

# Build all workspace members
cargo build --target wasm32-wasip2 $CARGO_FLAGS

echo ""
echo "=== Built components ==="

COMPONENTS=(adder greeter counter)
for name in "${COMPONENTS[@]}"; do
    WASM="target/wasm32-wasip2/$PROFILE/$name.wasm"
    if [[ -f "$WASM" ]]; then
        SIZE=$(du -h "$WASM" | cut -f1)
        echo "  ✅ $name ($SIZE) -> $WASM"

        # If wasm-tools is available, show the WIT interface
        if command -v wasm-tools &>/dev/null; then
            echo "     WIT interface:"
            wasm-tools component wit "$WASM" 2>/dev/null | sed 's/^/       /' || true
            echo ""
        fi
    else
        echo "  ❌ $name - build output not found at $WASM"
    fi
done

echo ""
echo "=== Done ==="
echo ""
echo "Component .wasm files are in: $SCRIPT_DIR/target/wasm32-wasip2/$PROFILE/"
echo ""
echo "To inspect a component:  wasm-tools component wit <file.wasm>"
echo "To validate a component: wasm-tools validate <file.wasm>"
