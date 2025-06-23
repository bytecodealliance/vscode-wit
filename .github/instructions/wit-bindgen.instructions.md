---
applyTo: "**"
---

# GitHub Copilot Instructions for wit-bindgen Projects

> **Note:** These instructions are in addition to the [general project instructions](.github/instructions/general.instructions.md) and [VS Code extension instructions](.github/instructions/vscode-extension.instructions.md). If there is any overlap, follow the general instructions and refer to this file for wit-bindgen–specific requirements.

## About wit-bindgen

`wit-bindgen` is a suite of bindings generators for languages compiled to WebAssembly that use the [Component Model](https://github.com/WebAssembly/component-model). It generates language-specific bindings from [WIT (WebAssembly Interface Types)](https://component-model.bytecodealliance.org/design/wit.html) files.

## Project Structure Requirements

- Store WIT files in a `wit/` directory adjacent to your main project file
- Use the `.wit` file extension for WIT interface definitions
- Organize WIT files by package and world definitions
- Include component type objects (`.o` files) in builds when required

## WIT File Guidelines

### Basic Structure
```wit
package example:host;

world host {
  import print: func(msg: string);
  export run: func();
}
```

### Interface Definitions
```wit
package example:my-game;

interface my-plugin-api {
  record coord {
    x: u32,
    y: u32,
  }
  
  get-position: func() -> coord;
  set-position: func(pos: coord);
}

world my-game {
  import print: func(msg: string);
  import my-plugin-api;
  export run: func();
}
```

### WIT Best Practices
- Use kebab-case for function and interface names
- Use meaningful package names following the format `namespace:package`
- Group related functionality into interfaces
- Define clear import/export boundaries in worlds
- Use appropriate WIT types (u32, string, list, record, etc.)

## Language-Specific Guidelines

### Rust Projects
- Use `wit_bindgen::generate!()` macro with world specification
- Implement the generated `Guest` trait for your component
- Use `export!()` macro to define component exports
- Build with `cargo build --target wasm32-wasip2`
- Add `crate-type = ["cdylib"]` to `Cargo.toml` for dynamic libraries

### C/C++ Projects
- Generate bindings with `wit-bindgen c ./wit`
- Include generated header files in your source
- Use WASI SDK for compilation to WebAssembly
- Link component type objects during build
- Compile with `-mexec-model=reactor` for non-main components

### C# Projects
- Generate bindings with `wit-bindgen csharp -w command -r native-aot --generate-stub wit/`
- Configure project for `wasi-wasm` runtime identifier
- Use native AOT compilation for WebAssembly targets
- Enable unsafe blocks when required

## Build Process

### Component Creation Workflow
1. **Generate Bindings**: Use `wit-bindgen` to create language-specific bindings
2. **Compile to Core WebAssembly**: Use native toolchain to produce `.wasm` module
3. **Transform to Component**: Use `wasm-tools component new` to create component

### WASI Adapter Usage
For projects using `wasi_snapshot_preview1`, use appropriate adapters:
- `wasi_snapshot_preview1.command.wasm` - CLI applications
- `wasi_snapshot_preview1.reactor.wasm` - Event-driven applications
- `wasi_snapshot_preview1.proxy.wasm` - Proxy applications

Example transformation:
```bash
wasm-tools component new ./my-core.wasm \
  --adapt wasi_snapshot_preview1=wasi_snapshot_preview1.command.wasm \
  -o my-component.wasm
```

## Testing and Validation

### Component Inspection
- Use `wasm-tools component wit ./component.wasm` to inspect WIT interface
- Validate component structure with `wasm-tools validate`
- Test components in compatible runtimes (Wasmtime, jco, etc.)

### Debug Support
- Use `WIT_BINDGEN_DEBUG=1` environment variable for debugging generated bindings
- Use `cargo expand` to examine generated Rust code
- Validate WIT syntax with `wasm-tools component wit-text`

## Integration with Host Runtimes

### Supported Runtimes
- **Rust**: `wasmtime` crate with `bindgen!` macro
- **JavaScript**: `jco` for web and Node.js execution
- **Python**: `wasmtime-py` with bindgen support
- **Ruby**: `wasmtime-rb` for component execution

### Component Composition
- Use `wasm-tools compose` for linking multiple components
- Ensure compatible WIT interfaces between components
- Validate composed components before deployment

## Development Workflow

### CLI Installation
```bash
cargo install wit-bindgen-cli
```

### Code Generation
```bash
# Generate language-specific bindings
wit-bindgen <language> ./wit

# Examples:
wit-bindgen rust ./wit
wit-bindgen c ./wit
wit-bindgen csharp -w command ./wit
```

### Build and Test
```bash
# Build component (language-specific)
cargo build --target wasm32-wasip2  # Rust
clang -o core.wasm ...              # C/C++

# Create component
wasm-tools component new core.wasm -o component.wasm

# Validate and inspect
wasm-tools validate component.wasm
wasm-tools component wit component.wasm
```

## Error Handling and Debugging

- Check for WIT syntax errors before code generation
- Validate that all imports/exports are properly implemented
- Ensure component type compatibility between host and guest
- Use appropriate error handling patterns for each target language
- Test components in isolation before integration

## Documentation Requirements

- Document WIT interfaces with clear comments
- Provide usage examples for generated bindings
- Document component capabilities and limitations
- Include build instructions for target platforms
- Maintain changelog for WIT interface changes

## Version Management

- Track `wit-bindgen` CLI version in project documentation
- Pin specific versions for reproducible builds
- Test compatibility when upgrading wit-bindgen versions
- Document breaking changes in WIT interface evolution

## Resources

- [WIT Documentation](https://component-model.bytecodealliance.org/design/wit.html)
- [Component Model Specification](https://github.com/WebAssembly/component-model)
- [wit-bindgen Repository](https://github.com/bytecodealliance/wit-bindgen)
- [wasm-tools Documentation](https://github.com/bytecodealliance/wasm-tools)
- [Bytecode Alliance Zulip](https://bytecodealliance.zulipchat.com/#narrow/stream/327223-wit-bindgen)

---
For wit-bindgen specific questions, reach out on [Zulip](https://bytecodealliance.zulipchat.com/#narrow/stream/327223-wit-bindgen) or check the [wit-bindgen repository](https://github.com/bytecodealliance/wit-bindgen).
