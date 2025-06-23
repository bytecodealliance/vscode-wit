# WIT IDL for VSCode

This package is a Visual Studio Code extension to recognize and highlight the WebAssembly Interface Type (WIT) Interface Definition Language (IDL). It can also be used as a bundle in TextMate.

The description of the WIT format can be found at: https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md


## Features

![Screenshot](images/screenshot.png)

This extension provides:
- Basic syntax highlighting of ".wit" files.
- [Snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets) for worlds and interfaces.
- Basic markdown highlighting in comments.
- Simple list-based autocomplete.
- **WIT Syntax Checking**: Validate WIT files for common syntax errors and provide diagnostics.

### Syntax Validation and Error Display

The extension provides comprehensive WIT syntax validation with error display in VS Code's PROBLEMS pane:

#### Automatic Validation
- **On File Save**: Automatically validates WIT files when saved
- **On File Open**: Validates WIT files when opened in the editor
- **Real-time Feedback**: Errors appear immediately in the PROBLEMS pane

#### Manual Commands
- **WIT: Check Syntax** (`Ctrl+Shift+P` → "WIT: Check Syntax")
  - Validates the currently active WIT file
  - Shows detailed error information in notifications
  - Displays errors in the PROBLEMS pane

- **WIT: Check Syntax in Workspace** (`Ctrl+Shift+P` → "WIT: Check Syntax in Workspace")
  - Validates all WIT files in the workspace
  - Shows progress notification during validation
  - Provides summary of results
  - Creates detailed report in output channel

#### Error Information
When validation fails, the extension displays:
- **Error location**: Precise line and column numbers
- **Error message**: Detailed description of the syntax error
- **Context**: Additional information about the error
- **Related information**: Links to relevant documentation or context

#### PROBLEMS Pane Integration
- Errors appear automatically in VS Code's PROBLEMS pane
- Click on any error to jump directly to the problematic line
- Errors are cleared automatically when files are fixed or closed
- Supports multiple files with errors simultaneously

### Code Completion

The extension offers intelligent code completion for WIT files:

- **Context-aware suggestions**: Provides completion items based on the current context
- **Keyword snippets**: Includes common WIT keywords and constructs
- **Custom snippets**: User-defined snippets for faster coding

### Command Palette Integration

Easily access extension features through the Command Palette:

- **WIT: Check Syntax**: Validate the current file's syntax
- **WIT: Check Syntax in Workspace**: Validate all WIT files in the workspace
- **WIT: Show Output Channel**: Display the extension's output channel

## Installation

### Prerequisites

This extension includes a WebAssembly component that requires the following tools for building:

- **Rust** (with `cargo`): Required for building the WebAssembly module
- **wasm-pack v0.13.1**: Used specifically for the `wit-bindgen-wasm` subproject

You can install these dependencies by running:
```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Run the setup script to install build tools
npm run setup-wasm
```

### From Source

To install from source, follow these steps:
* Clone the repository: `git clone https://github.com/bytecodealliance/vscode-wit.git && cd vscode-wit`
* Install build dependencies: `npm run setup-wasm`
* Run npm commands to install:
`npm ci && npm run install-plugin`
