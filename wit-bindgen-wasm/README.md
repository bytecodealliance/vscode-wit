# wit-bindgen-wasm

A simple WebAssembly wrapper for the Rust `wit-bindgen` package, designed to provide basic WIT (WebAssembly Interface Type) validation and parsing functionality in web environments.

## Features

- Basic WIT syntax validation
- Interface name extraction
- World definition detection
- WebAssembly-optimized build

## Building

To build the WebAssembly module:

```bash
# Install wasm-pack (specific version for consistency)
cargo install wasm-pack@0.13.1

# Build the WebAssembly package
wasm-pack build --target web --out-dir pkg
```

## Usage

The library provides a simple API through the `WitBindgen` class:

```javascript
import init, { WitBindgen } from './pkg/wit_bindgen_wasm.js';

async function main() {
    // Initialize the WASM module
    await init();
    
    // Create a new instance
    const witBindgen = new WitBindgen();
    
    // Validate WIT syntax
    const isValid = witBindgen.validate_wit_syntax(`
        interface calculator {
            add: func(a: u32, b: u32) -> u32;
        }
    `);
    
    console.log('Is valid WIT:', isValid);
    
    // Extract interface names
    const interfaces = witBindgen.extract_interfaces(witContent);
    console.log('Interfaces found:', interfaces);
}

main();
```

## API

### `WitBindgen`

- `new()` - Create a new instance
- `validate_wit_syntax(content: string): boolean` - Basic WIT syntax validation
- `extract_interfaces(content: string): string` - Extract comma-separated interface names
- `has_world_definition(content: string): boolean` - Check for world definitions
- `version(): string` - Get package version
- `generate_bindings(content: string, language: string, world_name?: string): string` - Generate language bindings (returns JSON with file map)

### Binary Safety Contract

**IMPORTANT**: The `generate_bindings` function returns file content that is encoded using Latin1 (ISO-8859-1) encoding to ensure binary data integrity. This allows both text and binary files (like `.wasm`, `.o`) to be safely transmitted through the WebAssembly string interface without corruption.

When consuming the output:
```javascript
const result = JSON.parse(witBindgen.generate_bindings(content, "rust"));
for (const [filename, content] of Object.entries(result.files)) {
    // Content is Latin1-encoded - decode properly when writing to disk
    const buffer = Buffer.from(content, 'latin1');
    fs.writeFileSync(filename, buffer);
}
```

### Utility Functions

- `is_wit_file_extension(filename: string): boolean` - Check if filename has .wit extension
- `get_wit_bindgen_version(): string` - Get library version

## Development

This is a minimal wrapper designed to be extended in future sessions. The current implementation provides basic functionality for WIT content analysis without full parsing capabilities.

## License

Apache-2.0 WITH LLVM-exception
