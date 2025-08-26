import * as vscode from "vscode";

/**
 * WIT document formatter that implements proper indentation, spacing, and alignment
 * for WIT (WebAssembly Interface Types) files.
 */
export class WitFormatter implements vscode.DocumentFormattingEditProvider {
    /**
     * Format the entire document
     */
    public provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions
    ): vscode.TextEdit[] {
        const text = document.getText();
        const formatted = this.formatWitContent(text, options);
        
        if (formatted === text) {
            return []; // No changes needed
        }
        
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length)
        );
        
        return [vscode.TextEdit.replace(fullRange, formatted)];
    }

    /**
     * Format the WIT content with proper indentation and spacing
     */
    private formatWitContent(content: string, options: vscode.FormattingOptions): string {
        const lines = content.split(/\r?\n/);
        const formatted: string[] = [];
        let indentLevel = 0;
        const indentString = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Skip empty lines and preserve them
            if (trimmed === "") {
                formatted.push("");
                continue;
            }
            
            // Handle closing braces - decrease indent before processing
            if (trimmed === "}" || trimmed === "},") {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            // Format the line with proper indentation and spacing
            const formattedLine = this.formatLine(trimmed, indentLevel, indentString);
            formatted.push(formattedLine);
            
            // Handle opening braces - increase indent after processing
            if (this.isOpeningBrace(trimmed)) {
                indentLevel++;
            }
        }
        
        return formatted.join("\n");
    }

    /**
     * Format a single line with proper spacing and indentation
     */
    private formatLine(line: string, indentLevel: number, indentString: string): string {
        const indent = indentString.repeat(indentLevel);
        
        // Handle comments - preserve as-is but with proper indentation
        if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*") || line.startsWith("*/")) {
            return indent + line;
        }
        
        // Handle doc comments
        if (line.startsWith("///")) {
            return indent + line;
        }
        
        // Format different WIT constructs
        let formatted = line;
        
        // Package declaration
        if (line.startsWith("package ")) {
            formatted = this.formatPackageDeclaration(line);
        }
        // Interface declaration
        else if (line.startsWith("interface ")) {
            formatted = this.formatInterfaceDeclaration(line);
        }
        // World declaration
        else if (line.startsWith("world ")) {
            formatted = this.formatWorldDeclaration(line);
        }
        // Record, variant, enum, flags declarations
        else if (this.isTypeDeclaration(line)) {
            formatted = this.formatTypeDeclaration(line);
        }
        // Type aliases (check before function declarations)
        else if (line.startsWith("type ") && line.includes("=")) {
            formatted = this.formatTypeAlias(line);
        }
        // Function declarations
        else if (this.isFunctionDeclaration(line)) {
            formatted = this.formatFunctionDeclaration(line);
        }
        // Import/export statements
        else if (line.startsWith("import ") || line.startsWith("export ")) {
            formatted = this.formatImportExport(line);
        }
        // Use statements
        else if (line.startsWith("use ")) {
            formatted = this.formatUseStatement(line);
        }
        // Field declarations (inside records, variants, etc.) - should be last
        else if (this.isFieldDeclaration(line)) {
            formatted = this.formatFieldDeclaration(line);
        }
        
        return indent + formatted;
    }

    /**
     * Check if a line opens a new block
     */
    private isOpeningBrace(line: string): boolean {
        return line.endsWith("{") && !line.includes("}");
    }

    /**
     * Format package declarations
     */
    private formatPackageDeclaration(line: string): string {
        // package namespace:name;
        return line.replace(/\s+/g, " ").replace(/\s*;\s*$/, ";");
    }

    /**
     * Format interface declarations
     */
    private formatInterfaceDeclaration(line: string): string {
        // interface name {
        return line.replace(/\s+/g, " ").replace(/\s*{\s*$/, " {");
    }

    /**
     * Format world declarations
     */
    private formatWorldDeclaration(line: string): string {
        // world name {
        return line.replace(/\s+/g, " ").replace(/\s*{\s*$/, " {");
    }

    /**
     * Check if line is a type declaration
     */
    private isTypeDeclaration(line: string): boolean {
        return /^(record|variant|enum|flags|resource)\s+/.test(line);
    }

    /**
     * Format type declarations
     */
    private formatTypeDeclaration(line: string): string {
        // record name {, variant name {, etc.
        return line.replace(/\s+/g, " ").replace(/\s*{\s*$/, " {");
    }

    /**
     * Check if line is a function declaration
     */
    private isFunctionDeclaration(line: string): boolean {
        // Don't treat import/export statements as function declarations
        if (line.startsWith("import ") || line.startsWith("export ")) {
            return false;
        }
        
        return line.includes(":func(") || line.includes(": func(") || 
               line.includes(":func()") || line.includes(": func()") ||
               line.includes(": func ") || line.endsWith(": func;") ||
               line.includes("->") || // Return type indicator
               /:\s*func\b/.test(line); // More general func detection
    }

    /**
     * Format function declarations
     */
    private formatFunctionDeclaration(line: string): string {
        let formatted = line;
        
        // Add space after colon if missing
        formatted = formatted.replace(/:func/, ": func");
        formatted = formatted.replace(/:\s*func/, ": func");
        
        // Format function parameters and return types
        formatted = formatted.replace(/func\s*\(/, "func(");
        formatted = formatted.replace(/\)\s*->\s*/, ") -> ");
        formatted = formatted.replace(/\)->\s*/, ") -> ");
        formatted = formatted.replace(/\)->/, ") -> ");
        formatted = formatted.replace(/,\s*/g, ", ");
        formatted = formatted.replace(/:\s*/g, ": ");
        
        // Handle trailing semicolon
        formatted = formatted.replace(/\s*;\s*$/, ";");
        
        return formatted;
    }

    /**
     * Check if line is a field declaration
     */
    private isFieldDeclaration(line: string): boolean {
        // Field declarations typically have: name: type, or name(type), or just name,
        return /^\s*[a-zA-Z][a-zA-Z0-9-]*\s*[:,(]/.test(line.trim()) || 
               /^\s*[a-zA-Z][a-zA-Z0-9-]*\s*,?\s*$/.test(line.trim());
    }

    /**
     * Format field declarations
     */
    private formatFieldDeclaration(line: string): string {
        let formatted = line;
        
        // Add space after colon
        formatted = formatted.replace(/:\s*/g, ": ");
        
        // Add space after comma
        formatted = formatted.replace(/,\s*/g, ", ");
        
        // Handle trailing comma
        formatted = formatted.replace(/,\s*$/, ",");
        
        return formatted;
    }

    /**
     * Format import/export statements
     */
    private formatImportExport(line: string): string {
        let formatted = line;
        
        // Normalize spaces after import/export keyword
        formatted = formatted.replace(/^(import|export)\s+/, "$1 ");
        
        // If this is a function export/import, format it completely here
        if (formatted.includes(": func") || formatted.includes(":func")) {
            // Add space after colon if missing
            formatted = formatted.replace(/:func/, ": func");
            formatted = formatted.replace(/:\s*func/, ": func");
            
            // Format function parameters and return types
            formatted = formatted.replace(/func\s*\(/, "func(");
            formatted = formatted.replace(/\)\s*->\s*/, ") -> ");
            formatted = formatted.replace(/\)->\s*/, ") -> ");
            formatted = formatted.replace(/\)->/, ") -> ");
            formatted = formatted.replace(/,\s*/g, ", ");
        }
        
        // Handle trailing semicolon
        formatted = formatted.replace(/\s*;\s*$/, ";");
        
        return formatted;
    }

    /**
     * Format use statements
     */
    private formatUseStatement(line: string): string {
        let formatted = line;
        
        // Add space after use
        formatted = formatted.replace(/^use\s+/, "use ");
        
        // Format as/from keywords
        formatted = formatted.replace(/\s+as\s+/, " as ");
        formatted = formatted.replace(/\s+from\s+/, " from ");
        
        // Handle trailing semicolon
        formatted = formatted.replace(/\s*;\s*$/, ";");
        
        return formatted;
    }

    /**
     * Format type aliases
     */
    private formatTypeAlias(line: string): string {
        let formatted = line;
        
        // Format type keyword
        if (formatted.startsWith("type ")) {
            formatted = formatted.replace(/^type\s+/, "type ");
        }
        
        // Format equals sign
        formatted = formatted.replace(/\s*=\s*/, " = ");
        
        // Handle trailing semicolon
        formatted = formatted.replace(/\s*;\s*$/, ";");
        
        return formatted;
    }
}