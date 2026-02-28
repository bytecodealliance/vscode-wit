# WIT Component Samples

Sample [WebAssembly Interface Types (WIT)](https://component-model.bytecodealliance.org/design/wit.html) projects that compile to WebAssembly components. These can be used to test the **vscode-wit** extension features such as WIT validation, binding generation, and WIT extraction from `.wasm` components.

## Samples

| Sample | Description | WIT Features |
|--------|-------------|--------------|
| [adder](adder/) | Adds two numbers | functions, `u32` type |
| [greeter](greeter/) | Greets a person by name, with multi-language support | strings, enums, multiple interfaces |
| [counter](counter/) | Stateful counter | resources, constructors, methods |

## Prerequisites

```bash
# Rust toolchain with the WASI P2 target
rustup target add wasm32-wasip2

# (Optional) wasm-tools for inspecting built components
cargo install wasm-tools
```

## Building

Build all samples at once:

```bash
# Debug build
./build.sh

# Release build (smaller binaries)
./build.sh --release
```

Or build individually:

```bash
cd adder
cargo build --target wasm32-wasip2
```

Built `.wasm` component files are output to `target/wasm32-wasip2/{debug,release}/`.

## Inspecting Components

After building, you can extract the WIT interface from any component:

```bash
wasm-tools component wit target/wasm32-wasip2/release/adder.wasm
```

Or use the **vscode-wit** extension: open a `.wasm` file and run the **Extract WIT** command.

## Sample Details

### adder

A minimal component based on the [official Component Model tutorial](https://component-model.bytecodealliance.org/language-support/building-a-simple-component/rust.html). Exports an `add` interface with a single function.

```wit
package docs:adder@0.1.0;

interface add {
    add: func(x: u32, y: u32) -> u32;
}

world adder {
    export add;
}
```

### greeter

Demonstrates string handling and enums. Exports two interfaces: a simple `greet` and a `multi-greet` that supports multiple languages.

```wit
package docs:greeter@0.1.0;

interface greet {
    greet: func(name: string) -> string;
}

interface multi-greet {
    enum language { english, spanish, french, german, japanese }
    greet-in: func(name: string, lang: language) -> string;
}

world greeter {
    export greet;
    export multi-greet;
}
```

### counter

Demonstrates WIT resources — object-like types with constructors and methods.

```wit
package docs:counter@0.1.0;

interface types {
    resource counter {
        constructor(initial: s32);
        increment-by: func(amount: s32) -> s32;
        decrement-by: func(amount: s32) -> s32;
        get-value: func() -> s32;
        reset: func() -> s32;
    }
}

world counter {
    export types;
}
```

## References

- [Component Model Book](https://component-model.bytecodealliance.org/)
- [WIT specification](https://component-model.bytecodealliance.org/design/wit.html)
- [wit-bindgen](https://github.com/bytecodealliance/wit-bindgen)
- [wasm-tools](https://github.com/bytecodealliance/wasm-tools)
