---
applyTo: "**/wit.tmLanguage.json"
---

# Instructions for WIT and Official Grammar

## 1. What is WIT?
- WIT (WebAssembly Interface Types) is a language and specification for describing interfaces between WebAssembly modules and their host environments.
- It defines types, functions, resources, and modules in a language-agnostic way.

## 2. Official Grammar
- The official WIT grammar is defined in the `wit.tmLanguage.json` file and is used for syntax highlighting and parsing.
- Refer to the [WIT specification](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md) for the authoritative grammar and language rules.
- The grammar covers:
  - Identifiers, keywords, and comments
  - Type definitions (records, variants, enums, flags, etc.)
  - Function and resource declarations
  - Module and world definitions
  - Versioning, namespace, and aliasing
  - Markdown in doc comments

## 3. Best Practices
- Follow the official WIT grammar for all `.wit` files.
- Use consistent formatting and indentation for readability.
- Validate `.wit` files using available tools or language support in your editor.
- Place WIT grammar and related files in the appropriate `syntaxes/` directory.
- When updating the grammar, also update or add tests in `tests/grammar/` to cover new features, edge cases, or bug fixes.
- If the WIT specification changes, update both the grammar and the tests to stay in sync.
- For complex or non-obvious grammar rules, add or expand comments in `wit.tmLanguage.json` to help future maintainers.
- Test new or changed grammar rules with both valid and invalid WIT syntax to ensure robust highlighting and error detection.

## 4. Resources
- [WIT Specification](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md)
- [wit.tmLanguage.json](syntaxes/wit.tmLanguage.json) (project grammar file)
- [WebAssembly Component Model](https://github.com/WebAssembly/component-model)
- [Grammar Tests](tests/grammar/) (test suite for grammar validation)

---
For questions about WIT or its grammar, contact project maintainers or refer to the official specification.
