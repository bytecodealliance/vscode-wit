---
applyTo: "**"
---

# GitHub Copilot Instructions for wit-parser Projects

> **Note:** These instructions are in addition to the [general project instructions](.github/instructions/general.instructions.md), [VS Code extension instructions](.github/instructions/vscode-extension.instructions.md), and [wit-bindgen instructions](.github/instructions/wit-bindgen.instructions.md). If there is any overlap, follow the general instructions and refer to this file for wit-parser specific requirements.

## About wit-parser

`wit-parser` is a Rust crate that provides tooling for parsing `*.wit` files and working with their contents. It's the core library for parsing WebAssembly Interface Types (WIT) definitions and creating fully resolved representations of WIT packages.

## Core Concepts

### Resolve Structure
The `Resolve` struct is the central data structure that contains a fully resolved set of WIT packages:

- **Arenas**: All items (worlds, interfaces, types, packages) are stored in arenas for efficient memory management
- **Topological Sorting**: All items are sorted topologically to ensure dependencies are resolved first
- **Index-based Access**: Everything is accessed by ID rather than name lookups for performance

### Key Data Structures

#### Primary Collections
- `worlds: Arena<World>` - All known worlds within the resolve
- `interfaces: Arena<Interface>` - All known interfaces within the resolve  
- `types: Arena<TypeDef>` - All known types, topologically sorted
- `packages: Arena<Package>` - All known packages
- `package_names: IndexMap<PackageName, PackageId>` - Map of package names to IDs

#### Features and Configuration
- `features: IndexSet<String>` - Activated features for this resolve
- `all_features: bool` - Whether to activate all features

## Essential Methods

### Creating and Loading WIT

#### Basic Creation
```rust
use wit_parser::Resolve;

// Create a new empty resolve
let mut resolve = Resolve::new();
// or use default
let mut resolve = Resolve::default();
```

#### Loading from File System
```rust
// Parse a path (directory, single file, or wasm-encoded WIT)
let (pkg_id, source_map) = resolve.push_path("./wit")?;

// Parse a directory containing WIT files
let (pkg_id, source_map) = resolve.push_dir("./wit")?;

// Parse a single WIT file
let pkg_id = resolve.push_file("./example.wit")?;

// Parse WIT from string content
let pkg_id = resolve.push_str("example.wit", wit_content)?;
```

### World Selection and Management

#### Selecting Worlds
```rust
// Select world by name from a package
let world_id = resolve.select_world(pkg_id, Some("my-world"))?;

// Select the only world if package has exactly one
let world_id = resolve.select_world(pkg_id, None)?;

// Select using fully qualified name
let world_id = resolve.select_world(pkg_id, Some("example:package/world"))?;

// Select with version specification
let world_id = resolve.select_world(pkg_id, Some("example:package/world@1.0.0"))?;
```

#### World Operations
```rust
// Merge one world into another
resolve.merge_worlds(from_world_id, into_world_id)?;

// Convert world to importized version (exports become imports)
resolve.importize(world_id, Some("imported-world-name".to_string()))?;

// Merge world imports based on semver compatibility
resolve.merge_world_imports_based_on_semver(world_id)?;
```

### Type System Navigation

#### Interface and Package Dependencies
```rust
// Get direct dependencies of an interface
let deps: Vec<InterfaceId> = resolve.interface_direct_deps(interface_id).collect();

// Get direct dependencies of a package  
let deps: Vec<PackageId> = resolve.package_direct_deps(package_id).collect();

// Get topologically sorted packages
let sorted_packages = resolve.topological_packages();
```

#### Type Information
```rust
// Check if type has valid bit patterns
let is_valid = resolve.all_bits_valid(&type_def);

// Get interface that a type depends on
let dep_interface = resolve.type_interface_dep(type_id);
```

### Name Resolution and Mangling

#### Interface and Package Naming
```rust
// Get interface ID string
let id = resolve.id_of(interface_id);

// Get canonicalized interface name
let canonical_name = resolve.canonicalized_id_of(interface_id);

// Get ID for name within package
let id = resolve.id_of_name(package_id, "interface-name");

// Get canonicalized ID for name within package
let canonical_id = resolve.canonicalized_id_of_name(package_id, "interface-name");
```

#### World Key Naming
```rust
// Get human readable name for world key
let name = resolve.name_world_key(&world_key);

// Get canonicalized world key name  
let canonical_name = resolve.name_canonicalized_world_key(&world_key);
```

### WebAssembly Integration

#### Import/Export Name Generation
```rust
use wit_parser::{ManglingAndAbi, WasmImport, WasmExport};

// Generate core wasm import names
let (module, field) = resolve.wasm_import_name(
    ManglingAndAbi::default(),
    WasmImport::Function { ... }
);

// Generate core wasm export names
let export_name = resolve.wasm_export_name(
    ManglingAndAbi::default(),
    WasmExport::Function { ... }
);
```

#### WebAssembly Signatures
```rust
use wit_parser::abi::AbiVariant;

// Get WebAssembly type signature for function
let wasm_signature = resolve.wasm_signature(AbiVariant::GuestExport, &function);
```

### Advanced Operations

#### Merging Resolves
```rust
// Merge another resolve into this one
let remap = resolve.merge(other_resolve)?;

// Use remap to translate old IDs to new IDs
let new_id = remap.worlds[old_world_id];
```

#### Feature Management
```rust
// Enable specific features
resolve.features.insert("experimental".to_string());

// Enable all features
resolve.all_features = true;
```

## Best Practices

### Error Handling
- Always handle `Result` types returned by parsing methods
- Use `anyhow::Result` for error propagation in applications
- Check for dependency resolution errors when pushing packages

### Performance Considerations
- Use `push_path` for most file system operations as it handles different input types
- Prefer index-based access over name lookups once packages are loaded
- Cache `Resolve` instances when possible to avoid re-parsing

### Dependency Management
- Load dependencies before dependent packages
- Use `topological_packages()` to get dependency-ordered package lists
- Check `package_direct_deps()` to understand package relationships

### Type Safety
- Use the type ID system rather than string comparisons
- Leverage the arena-based storage for memory efficiency
- Validate types using `all_bits_valid()` when needed

## Common Patterns

### Loading a WIT Package with Dependencies
```rust
let mut resolve = Resolve::default();

// Load main package (automatically handles deps/ directory)
let (main_pkg, source_map) = resolve.push_dir("./wit")?;

// Select world for code generation
let world_id = resolve.select_world(main_pkg, Some("my-world"))?;
```

### Iterating Over Package Contents
```rust
let package = &resolve.packages[package_id];

// Iterate over interfaces in package
for &interface_id in &package.interfaces {
    let interface = &resolve.interfaces[interface_id];
    println!("Interface: {}", interface.name.as_deref().unwrap_or("anonymous"));
}

// Iterate over worlds in package  
for &world_id in &package.worlds {
    let world = &resolve.worlds[world_id];
    println!("World: {}", world.name);
}
```

### Type Visitor Pattern
```rust
use wit_parser::TypeIdVisitor;

struct MyTypeVisitor;

impl TypeIdVisitor for MyTypeVisitor {
    fn visit_type_id(&mut self, ty: &TypeId) {
        // Process each type ID
        println!("Visiting type: {:?}", ty);
    }
}

// Visit all types in a type definition
let mut visitor = MyTypeVisitor;
some_type.visit_type_id(&mut visitor);
```

## Error Handling Patterns

### Dependency Resolution
```rust
match resolve.push_dir("./wit") {
    Ok((pkg_id, source_map)) => {
        // Success case
    }
    Err(e) => {
        if let Some(invalid_dep) = e.downcast_ref::<InvalidTransitiveDependency>() {
            // Handle dependency issues
            eprintln!("Dependency error: {}", invalid_dep);
        } else {
            // Handle other parsing errors
            eprintln!("Parse error: {}", e);
        }
    }
}
```

### World Selection
```rust
let world_id = match resolve.select_world(pkg_id, world_name) {
    Ok(id) => id,
    Err(e) => {
        if world_name.is_none() {
            eprintln!("Multiple worlds found, please specify one: {}", e);
            // List available worlds
            let package = &resolve.packages[pkg_id];
            for &world_id in &package.worlds {
                let world = &resolve.worlds[world_id];
                eprintln!("  - {}", world.name);
            }
        }
        return Err(e);
    }
};
```

## Integration Guidelines

### With wit-bindgen
- Use `resolve.select_world()` to choose target world for code generation
- Pass the `Resolve` and `WorldId` to wit-bindgen APIs
- Ensure all dependencies are loaded before generating bindings

### With wasm-tools
- Use `resolve.wasm_import_name()` and `resolve.wasm_export_name()` for component model integration
- Leverage `resolve.wasm_signature()` for WebAssembly function signatures
- Use topological package ordering for component composition

### Error Reporting
- Include source map information in error messages when available
- Use `PackageSourceMap` to provide file location context
- Preserve original package structure for debugging

## Dependencies and Versioning

### Cargo.toml Configuration
```toml
[dependencies]
wit-parser = "0.235"
anyhow = "1.0"      # For error handling
indexmap = "2.0"    # Used by wit-parser
```

### Feature Flags
- Check available feature flags: `wit-parser = { version = "0.235", features = ["..."] }`
- Default features are usually sufficient for most use cases

## Resources

- [wit-parser Documentation](https://docs.rs/wit-parser)
- [WIT Specification](https://component-model.bytecodealliance.org/design/wit.html)
- [Component Model Documentation](https://github.com/WebAssembly/component-model)
- [wit-bindgen Integration](https://github.com/bytecodealliance/wit-bindgen)

---
For wit-parser specific questions, consult the [documentation](https://docs.rs/wit-parser) or ask on [Zulip](https://bytecodealliance.zulipchat.com/).
