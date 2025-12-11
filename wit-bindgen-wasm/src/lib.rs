use wasm_bindgen::prelude::*;
use std::collections::HashMap;
use std::path::Path;

use wit_parser::{Resolve, PackageId};
use anyhow::Context;
// For component decoding (no text printing here; CLI fallback will be used)
use wit_component as wcomp;
use wasmparser::{Parser, Payload};
use wit_bindgen_core::Files;
use wit_bindgen_rust as rust;
use wit_bindgen_c as c;
use wit_bindgen_cpp as cpp;
use wit_bindgen_csharp as csharp;
use wit_bindgen_moonbit as moonbit;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Initialize the panic hook for better error messages in development
#[wasm_bindgen(start)]
pub fn main() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// Helper function for logging errors to console
#[cfg(target_arch = "wasm32")]
fn console_error(msg: &str) {
    web_sys::console::error_1(&msg.into());
}

#[cfg(not(target_arch = "wasm32"))]
fn console_error(msg: &str) {
    eprintln!("{}", msg);
}

/// Convert bytes to Latin1 string encoding for safe round-trip conversion
/// Each byte (0-255) maps directly to Unicode code point (0-255)
fn bytes_to_latin1_string(bytes: &[u8]) -> String {
    bytes.iter().map(|&b| b as char).collect()
}

/// A WIT validation and processing instance
#[wasm_bindgen]
#[derive(Default)]
pub struct WitBindgen {
    #[wasm_bindgen(skip)]
    pub inner: String,
}

#[wasm_bindgen]
impl WitBindgen {
    /// Create a new WitBindgen instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> WitBindgen {
        WitBindgen {
            inner: String::new(),
        }
    }

    /// Extract WIT text from a WebAssembly component (bytes)
    /// Returns an empty string on error (JS side will fall back to CLI)
    #[wasm_bindgen(js_name = extractWitFromComponent)]
    pub fn extract_wit_from_component(&self, bytes: &[u8]) -> String {
        match Self::extract_wit_from_component_impl(bytes) {
            Ok(s) => s,
            Err(e) => {
                console_error(&format!("WIT extraction failed: {}", e));
                String::new()
            }
        }
    }

    fn extract_wit_from_component_impl(bytes: &[u8]) -> anyhow::Result<String> {
        // Decode component/package and render WIT using wit-component printing utilities
        let decoded = wcomp::decode(bytes)
            .with_context(|| "failed to decode component metadata to WIT")?;

        // Prepare printer
        let mut printer = wcomp::WitPrinter::new(wcomp::OutputToString::default());
        // Keep docs in output (default true); call emit_docs(true) explicitly for clarity
        let _ = printer.emit_docs(true);

        // Build the list of nested packages: all dependencies of the main package
        let resolve: &Resolve = decoded.resolve();
        let main_pkg: PackageId = decoded.package();

        // Collect transitive deps of main_pkg
        use std::collections::{HashSet, VecDeque};
        let mut visited: HashSet<PackageId> = HashSet::new();
        let mut queue: VecDeque<PackageId> = VecDeque::new();
        queue.push_back(main_pkg);
        visited.insert(main_pkg);
        while let Some(pkg) = queue.pop_front() {
            for dep in resolve.package_direct_deps(pkg) {
                if !visited.contains(&dep) {
                    visited.insert(dep);
                    queue.push_back(dep);
                }
            }
        }
        // Order nested by topo order, excluding main package
        let nested: Vec<PackageId> = resolve
            .topological_packages()
            .into_iter()
            .filter(|p| *p != main_pkg && visited.contains(p))
            .collect();

        // Print into a string
        printer
            .print(resolve, main_pkg, &nested)
            .with_context(|| "failed to render WIT text from decoded component")?;
        let out: String = printer.output.into();
        Ok(out)
    }

    /// Extract core WebAssembly modules from a component.
    /// Returns a JSON object mapping filename -> latin1 content.
    /// If no core modules are found, returns an empty JSON object.
    #[wasm_bindgen(js_name = extractCoreWasmFromComponent)]
    pub fn extract_core_wasm_from_component(&self, bytes: &[u8]) -> String {
        match Self::extract_core_wasm_impl(bytes) {
            Ok(map) => serde_json::to_string(&map).unwrap_or_else(|_| "{}".to_string()),
            Err(e) => {
                console_error(&format!("Core wasm extraction failed: {}", e));
                "{}".to_string()
            }
        }
    }

    fn extract_core_wasm_impl(bytes: &[u8]) -> anyhow::Result<std::collections::HashMap<String, String>> {
        let mut map = std::collections::HashMap::new();

        // Use wasmparser's incremental Parser with component-model feature enabled.
        // This will iterate payloads and yield ModuleSection for embedded core modules.
        let parser = Parser::new(0);
        let mut index: usize = 0;
        for payload in parser.parse_all(bytes) {
            let payload = payload?;
            match payload {
                // Embedded core module inside a component
                Payload::ModuleSection { unchecked_range, .. } => {
                    let module_bytes = &bytes[unchecked_range.start..unchecked_range.end];
                    let filename = format!("core{index}.wasm");
                    map.insert(filename, bytes_to_latin1_string(module_bytes));
                    index += 1;
                }
                // Nested component: continue; parse_all already iterates it
                Payload::ComponentSection { .. } => {}
                _ => {}
            }
        }

        Ok(map)
    }

    /// Validate WIT syntax using wit-parser
    #[wasm_bindgen(js_name = validateWitSyntax)]
    pub fn validate_wit_syntax(&self, content: &str) -> bool {
        let trimmed = content.trim();
        
        if trimmed.is_empty() {
            return false;
        }

        let inline_path = Path::new("inline.wit");
        let mut resolve = Resolve::default();
        match resolve.push_str(inline_path, trimmed) {
            Ok(_package_id) => true,
            Err(e) => {
                #[cfg(feature = "console_error_panic_hook")]
                console_error(&format!("WIT parsing failed: {}", e));
                false
            }
        }
    }

    /// Extract interface names from WIT content
    #[wasm_bindgen(js_name = extractInterfaces)]
    pub fn extract_interfaces(&self, content: &str) -> String {
        let mut interfaces = Vec::new();
        
        let inline_path = Path::new("inline.wit");
        let mut resolve = Resolve::default();
        match resolve.push_str(inline_path, content) {
            Ok(package_id) => {
                let package = &resolve.packages[package_id];
                for (interface_name, _interface_id) in &package.interfaces {
                    interfaces.push(interface_name.clone());
                }
            }
            Err(_) => {}
        }
        
        interfaces.join(", ")
    }

    /// Check if content contains world definitions
    #[wasm_bindgen(js_name = hasWorldDefinition)]
    pub fn has_world_definition(&self, content: &str) -> bool {
        let inline_path = Path::new("inline.wit");
        let mut resolve = Resolve::default();
        match resolve.push_str(inline_path, content) {
            Ok(package_id) => {
                let package = &resolve.packages[package_id];
                !package.worlds.is_empty()
            }
            Err(_) => content.contains("world "),
        }
    }

    /// Get version information
    #[wasm_bindgen]
    pub fn version(&self) -> String {
        env!("WIT_BINDGEN_CORE_VERSION").to_string()
    }

    /// Generate language bindings from WIT content
    /// Supports: rust, c, csharp, go, moonbit
    /// Returns JSON string containing file map
    #[wasm_bindgen(js_name = generateBindings)]
    pub fn generate_bindings(&self, content: &str, language: &str, world_name: Option<String>) -> String {
        let files = match language.to_lowercase().as_str() {
            "rust" => self.generate_rust_bindings(content, world_name),
            "c" => self.generate_c_bindings(content, world_name),
            "cpp" | "c++" => self.generate_cpp_bindings(content, world_name),
            "csharp" | "c#" => self.generate_csharp_bindings(content, world_name),
            "go" => self.generate_go_bindings(content, world_name),
            "moonbit" => self.generate_moonbit_bindings(content, world_name),
            _ => {
                let mut error_files = HashMap::new();
                error_files.insert(
                    "error.txt".to_string(), 
                    format!("// Unsupported language: {}\n// Supported languages: rust, c, cpp, csharp, go, moonbit", language)
                );
                error_files
            },
        };
        
        serde_json::to_string(&files).unwrap_or_else(|_| "{}".to_string())
    }

    /// Generate C bindings using wit-bindgen-c library
    fn generate_c_bindings(&self, content: &str, world_name: Option<String>) -> HashMap<String, String> {
        match self.generate_c_with_wit_bindgen(content, world_name.as_deref()) {
            Ok(files) => files,
            Err(e) => {
                console_error(&format!("wit-bindgen-c failed: {}", e));
                let mut error_files = HashMap::new();
                error_files.insert(
                    "error.txt".to_string(),
                    format!("C binding generation failed: {}", e)
                );
                error_files
            }
        }
    }
    
    /// Generate C bindings using wit-bindgen-c library
    fn generate_c_with_wit_bindgen(&self, content: &str, world_name: Option<&str>) -> Result<HashMap<String, String>, anyhow::Error> {
        let inline_path = Path::new("inline.wit");
        let mut resolve = Resolve::default();
        let package_id = resolve.push_str(inline_path, content)
            .with_context(|| "Failed to parse WIT content for C binding generation")?;
        
        let world_id = if let Some(world_name) = world_name {
            resolve.select_world(&[package_id], Some(world_name))?
        } else {
            resolve.select_world(&[package_id], None)?
        };
        
        let opts = c::Opts::default();
        let mut generator = opts.build();
        let mut files = Files::default();
        
        generator.generate(&resolve, world_id, &mut files)?;
        
        let mut result = HashMap::new();
        for (filename, content) in files.iter() {
            result.insert(filename.to_string(), bytes_to_latin1_string(content));
        }
        
        Ok(result)
    }
    
    /// Generate C++ bindings using wit-bindgen-cpp library
    fn generate_cpp_bindings(&self, content: &str, world_name: Option<String>) -> HashMap<String, String> {
        match self.generate_cpp_with_wit_bindgen(content, world_name.as_deref()) {
            Ok(files) => files,
            Err(e) => {
                console_error(&format!("wit-bindgen-cpp failed: {}", e));
                let mut error_files = HashMap::new();
                error_files.insert(
                    "error.txt".to_string(),
                    format!("C++ binding generation failed: {}", e)
                );
                error_files
            }
        }
    }
    
    /// Generate C++ bindings using wit-bindgen-cpp library
    fn generate_cpp_with_wit_bindgen(&self, content: &str, world_name: Option<&str>) -> Result<HashMap<String, String>, anyhow::Error> {
        let inline_path = Path::new("inline.wit");
        let mut resolve = Resolve::default();
        let package_id = resolve.push_str(inline_path, content)
            .with_context(|| "Failed to parse WIT content for C++ binding generation")?;
        
        let world_id = if let Some(world_name) = world_name {
            resolve.select_world(&[package_id], Some(world_name))?
        } else {
            resolve.select_world(&[package_id], None)?
        };
        
        let opts = cpp::Opts::default();
        let mut generator = opts.build(None);
        let mut files = Files::default();
        
        generator.generate(&resolve, world_id, &mut files)?;
        
        let mut result = HashMap::new();
        for (filename, content) in files.iter() {
            result.insert(filename.to_string(), bytes_to_latin1_string(content));
        }
        
        Ok(result)
    }
    
    /// Generate Rust bindings using wit-bindgen-rust library
    fn generate_rust_bindings(&self, content: &str, world_name: Option<String>) -> HashMap<String, String> {
        match self.generate_rust_with_wit_bindgen(content, world_name.as_deref()) {
            Ok(files) => files,
            Err(e) => {
                console_error(&format!("wit-bindgen-rust failed: {}", e));
                let mut error_files = HashMap::new();
                error_files.insert(
                    "error.txt".to_string(),
                    format!("Rust binding generation failed: {}", e)
                );
                error_files
            }
        }
    }

    /// Generate Rust bindings using wit-bindgen-rust library
    fn generate_rust_with_wit_bindgen(&self, content: &str, world_name: Option<&str>) -> Result<HashMap<String, String>, anyhow::Error> {
        let inline_path = Path::new("inline.wit");
        let mut resolve = Resolve::default();
        let package_id = resolve.push_str(inline_path, content)
            .with_context(|| "Failed to parse WIT content for Rust binding generation")?;
        
        let world_id = if let Some(world_name) = world_name {
            resolve.select_world(&[package_id], Some(world_name))?
        } else {
            resolve.select_world(&[package_id], None)?
        };
        
        let opts = rust::Opts { 
            generate_all: true, 
            ..Default::default() 
        };
        let mut generator = opts.build();
        let mut files = Files::default();
        
        generator.generate(&resolve, world_id, &mut files)?;
        
        let mut result = HashMap::new();
        for (filename, content) in files.iter() {
            result.insert(filename.to_string(), bytes_to_latin1_string(content));
        }
        
        Ok(result)
    }

    /// Generate C# bindings using wit-bindgen-csharp library
    fn generate_csharp_bindings(&self, content: &str, world_name: Option<String>) -> HashMap<String, String> {
        match self.generate_csharp_with_wit_bindgen(content, world_name.as_deref()) {
            Ok(files) => files,
            Err(e) => {
                console_error(&format!("wit-bindgen-csharp failed: {}", e));
                let mut error_files = HashMap::new();
                error_files.insert(
                    "error.txt".to_string(),
                    format!("C# binding generation failed: {}", e)
                );
                error_files
            }
        }
    }

    /// Generate C# bindings using wit-bindgen-csharp library
    fn generate_csharp_with_wit_bindgen(&self, content: &str, world_name: Option<&str>) -> Result<HashMap<String, String>, anyhow::Error> {
        let inline_path = Path::new("inline.wit");
        let mut resolve = Resolve::default();
        let package_id = resolve.push_str(inline_path, content)
            .with_context(|| "Failed to parse WIT content for C# binding generation")?;
        
        let world_id = if let Some(world_name) = world_name {
            resolve.select_world(&[package_id], Some(world_name))?
        } else {
            resolve.select_world(&[package_id], None)?
        };
        
        let opts = csharp::Opts::default();
        let mut generator = opts.build();
        let mut files = Files::default();
        
        generator.generate(&resolve, world_id, &mut files)?;
        
        let mut result = HashMap::new();
        for (filename, content) in files.iter() {
            result.insert(filename.to_string(), bytes_to_latin1_string(content));
        }
        
        Ok(result)
    }

    /// Generate Go bindings - Note: wit-bindgen Go support has moved
    fn generate_go_bindings(&self, _content: &str, _world_name: Option<String>) -> HashMap<String, String> {
        let mut files = HashMap::new();
        files.insert(
            "README.md".to_string(),
            "# Go Bindings Generation\n\n\
            The wit-bindgen Go generators have been moved to a separate project.\n\n\
            ## New Go Implementation\n\n\
            Please use the new Go WIT bindings generator:\n\n\
            ```bash\n\
            # Install the new Go generator\n\
            go install go.bytecodealliance.org/cmd/wit-bindgen-go@latest\n\n\
            # Generate Go bindings\n\
            wit-bindgen-go generate <path-to-wit-pkg>\n\
            ```\n\n\
            For more information, visit: https://github.com/bytecodealliance/go-modules\n\n\
            Note: This requires `wasm-tools` to be installed.".to_string()
        );
        files
    }

    /// Generate MoonBit bindings using wit-bindgen-moonbit library
    fn generate_moonbit_bindings(&self, content: &str, world_name: Option<String>) -> HashMap<String, String> {
        match self.generate_moonbit_with_wit_bindgen(content, world_name.as_deref()) {
            Ok(files) => files,
            Err(e) => {
                console_error(&format!("wit-bindgen-moonbit failed: {}", e));
                let mut error_files = HashMap::new();
                error_files.insert(
                    "error.txt".to_string(),
                    format!("MoonBit binding generation failed: {}", e)
                );
                error_files
            }
        }
    }

    /// Generate MoonBit bindings using wit-bindgen-moonbit library
    fn generate_moonbit_with_wit_bindgen(&self, content: &str, world_name: Option<&str>) -> Result<HashMap<String, String>, anyhow::Error> {
        let inline_path = Path::new("inline.wit");
        let mut resolve = Resolve::default();
        let package_id = resolve.push_str(inline_path, content)
            .with_context(|| "Failed to parse WIT content for MoonBit binding generation")?;
        
        let world_id = if let Some(world_name) = world_name {
            resolve.select_world(&[package_id], Some(world_name))?
        } else {
            resolve.select_world(&[package_id], None)?
        };
        
        let opts = moonbit::Opts::default();
        let mut generator = opts.build();
        let mut files = Files::default();
        
        generator.generate(&resolve, world_id, &mut files)?;
        
        let mut result = HashMap::new();
        for (filename, content) in files.iter() {
            result.insert(filename.to_string(), bytes_to_latin1_string(content));
        }
        
        Ok(result)
    }

    /// Validate WIT syntax and return detailed error information
    #[wasm_bindgen(js_name = validateWitSyntaxDetailed)]
    pub fn validate_wit_syntax_detailed(&self, content: &str) -> String {
        let trimmed = content.trim();
        
        if trimmed.is_empty() {
            return serde_json::json!({
                "valid": false,
                "error": "Empty or whitespace-only content is not valid WIT",
                "errorType": "validation"
            }).to_string();
        }

        let inline_path = Path::new("inline.wit");
        let mut resolve = Resolve::default();
        match resolve.push_str(inline_path, trimmed) {
            Ok(_package_id) => {
                serde_json::json!({
                    "valid": true
                }).to_string()
            }
            Err(e) => {
                let error_message = e.to_string();
                
                #[cfg(feature = "console_error_panic_hook")]
                console_error(&format!("WIT parsing failed: {}", error_message));
                
                if error_message.contains("package not found") || 
                   error_message.contains("interface not found") ||
                   error_message.contains("failed to find package") {
                        serde_json::json!({
                            "valid": false,
                            "error": format!("Dependency error: {}", error_message),
                            "errorType": "dependency"
                        }).to_string()
                } else {
                    serde_json::json!({
                        "valid": false,
                        "error": error_message,
                        "errorType": "parsing"
                    }).to_string()
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_wit_syntax_with_undefined_type() {
        let wit_bindgen = WitBindgen::new();
        
        let invalid_content = r#"package foo:foo;

interface i {
  type type1 = u32;
}

world foo {
  use i.{type1};

  type type2 = u32;

  record type3 {
    r: u32,
  }

  export foo: func() -> tuple<type1, type2, type3, type4>;
}"#;

        let result = wit_bindgen.validate_wit_syntax(invalid_content);
        assert!(!result, "Should detect undefined type4 as invalid");
    }

    #[test]
    fn test_validate_wit_syntax_with_valid_content() {
        let wit_bindgen = WitBindgen::new();
        
        let valid_content = r#"package foo:foo;

world foo {
}"#;

        let result = wit_bindgen.validate_wit_syntax(valid_content);
        assert!(result, "Should validate correct WIT syntax as valid");
    }

    #[test]
    fn test_validate_wit_syntax_with_empty_content() {
        let wit_bindgen = WitBindgen::new();
        
        let result = wit_bindgen.validate_wit_syntax("");
        assert!(!result, "Empty content should be invalid");
        
        let result = wit_bindgen.validate_wit_syntax("   \n  \t  ");
        assert!(!result, "Whitespace-only content should be invalid");
    }

    #[test]
    fn test_validate_wit_syntax_with_sized_lists() {
        let wit_bindgen = WitBindgen::new();
        
        let valid_content = r#"package foo:foo;

interface test {
  get-ipv4-address1: func() -> list<u8, 4>;
  get-ipv4-address2: func() -> tuple<u8, u8, u8, u8>;
}

world test-world {
  export test;
}"#;

        let result = wit_bindgen.validate_wit_syntax(valid_content);
        assert!(result, "Should validate sized list syntax as valid");
    }
}
