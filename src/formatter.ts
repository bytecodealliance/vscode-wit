import * as vscode from "vscode";

export class WitFormatter implements vscode.DocumentFormattingEditProvider {
    private static replaceAll(line: string, replacements: Array<[RegExp, string]>): string {
        let out = line;
        for (const [pattern, repl] of replacements) {
            out = out.replace(pattern, repl);
        }
        return out;
    }

    private static ensureSemicolon(line: string): string {
        return line.replace(/\s*;\s*$/, ";");
    }

    private static collapseSpaces(line: string): string {
        return line.replace(/\s+/g, " ");
    }

    public provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions
    ): vscode.TextEdit[] {
        const text = document.getText();
        const formatted = this.formatWitContent(text, options);
        if (formatted === text) {
            return [];
        }
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
        return [vscode.TextEdit.replace(fullRange, formatted)];
    }

    public formatWitContent(content: string, options: vscode.FormattingOptions): string {
        const tabSize = options.tabSize ?? 2;
        const insertSpaces = options.insertSpaces !== false;
        const indentUnit = insertSpaces ? " ".repeat(tabSize) : "\t";
        const lines = content.split(/\r?\n/);
        const out: string[] = [];
        let indentLevel = 0;
        let inMultiLineTupleAlias = false;
        let aliasGenericDepth = 0;
        let inFuncParams = false;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const trimmed = raw.trim();
            if (trimmed === "") {
                out.push("");
                continue;
            }
            if (/^\}/.test(trimmed)) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            if (/^\/\//.test(trimmed)) {
                const extra = inMultiLineTupleAlias && aliasGenericDepth > 0 && !/^>>/.test(trimmed) ? 1 : 0;
                out.push(indentUnit.repeat(indentLevel + extra) + trimmed);
                continue;
            }
            const formattedLine = this.formatLine(trimmed);
            const needsTupleExtra = inMultiLineTupleAlias && aliasGenericDepth > 0 && !/^>>/.test(trimmed);
            const needsFuncParamExtra = inFuncParams && !/^\)/.test(trimmed);
            out.push(
                indentUnit.repeat(indentLevel + (needsTupleExtra ? 1 : 0) + (needsFuncParamExtra ? 1 : 0)) +
                    formattedLine
            );
            if (this.isOpeningBrace(trimmed)) {
                indentLevel++;
            }
            if (!inFuncParams && /func\($/.test(trimmed)) {
                let lookahead = i + 1;
                let activate = true;
                while (lookahead < lines.length) {
                    const laTrim = lines[lookahead].trim();
                    if (laTrim === "") {
                        lookahead++;
                        continue;
                    }
                    if (/^\/\//.test(laTrim)) {
                        activate = false;
                    }
                    break;
                }
                if (activate) {
                    inFuncParams = true;
                }
            } else if (inFuncParams && /^\)/.test(trimmed)) {
                inFuncParams = false;
            }
            if (!inMultiLineTupleAlias && /^type\s+[^=]+=.*tuple<\s*$/.test(trimmed)) {
                inMultiLineTupleAlias = true;
                aliasGenericDepth = (trimmed.match(/</g) || []).length - (trimmed.match(/>/g) || []).length;
            } else if (inMultiLineTupleAlias) {
                const opens = (trimmed.match(/</g) || []).length;
                const closes = (trimmed.match(/>/g) || []).length;
                aliasGenericDepth += opens - closes;
                if (aliasGenericDepth <= 0) {
                    inMultiLineTupleAlias = false;
                }
            }
        }
        return out.join("\n");
    }

    private isOpeningBrace(line: string): boolean {
        return line.endsWith("{") && !line.includes("}");
    }

    private formatLine(line: string): string {
        if (line.startsWith("package ")) return this.formatPackage(line);
        if (line.startsWith("interface ")) return this.formatNamedBlock(line);
        if (line.startsWith("world ")) return this.formatNamedBlock(line);
        if (this.isTypeDecl(line)) return this.formatNamedBlock(line);
        if (line.startsWith("type ") && line.includes("=")) return this.formatTypeAlias(line);
        if (this.isFuncDecl(line)) return this.formatFunc(line);
        if (line.startsWith("import ") || line.startsWith("export ")) return this.formatImportExport(line);
        if (line.startsWith("use ")) return this.formatUse(line);
        if (this.isFieldDecl(line)) return this.formatField(line);
        return line;
    }

    private isTypeDecl(line: string): boolean {
        return /^(record|variant|enum|flags|resource)\s+/.test(line);
    }
    private isFuncDecl(line: string): boolean {
        if (line.startsWith("import ") || line.startsWith("export ")) return false;
        return /^[a-zA-Z][\w-]*\s*:\s*func\b/.test(line) || /:\s*func\b/.test(line) || /->/.test(line);
    }
    private isFieldDecl(line: string): boolean {
        const t = line.trim();
        return /^[a-zA-Z][a-zA-Z0-9-]*\s*[:,(]/.test(t) || /^[a-zA-Z][a-zA-Z0-9-]*\s*,?\s*$/.test(t);
    }

    private formatPackage(line: string): string {
        return WitFormatter.ensureSemicolon(WitFormatter.collapseSpaces(line));
    }
    private formatNamedBlock(line: string): string {
        return WitFormatter.collapseSpaces(line).replace(/\s*{\s*$/, " {");
    }
    private formatFunc(line: string): string {
        const replacements: Array<[RegExp, string]> = [
            [/:func/, ": func"],
            [/:\s*func/, ": func"],
            [/func\s*\(/, "func("],
            [/\)\s*->\s*/, ") -> "],
            [/\)->\s*/, ") -> "],
            [/\)->/, ") -> "],
            [/,\s*/g, ", "],
            [/:\s*/g, ": "],
        ];
        return WitFormatter.ensureSemicolon(WitFormatter.replaceAll(line, replacements));
    }
    private formatImportExport(line: string): string {
        const base = line.replace(/^(import|export)\s+/, "$1 ");
        if (base.includes(": func") || base.includes(":func")) return this.formatFunc(base);
        return WitFormatter.ensureSemicolon(base);
    }
    private formatUse(line: string): string {
        const replacements: Array<[RegExp, string]> = [
            [/^use\s+/, "use "],
            [/\s+as\s+/, " as "],
            [/\s+from\s+/, " from "],
        ];
        return WitFormatter.ensureSemicolon(WitFormatter.replaceAll(line, replacements));
    }
    private formatTypeAlias(line: string): string {
        const replacements: Array<[RegExp, string]> = [
            [/^type\s+/, "type "],
            [/\s*=\s*/, " = "],
        ];
        return WitFormatter.ensureSemicolon(WitFormatter.replaceAll(line, replacements));
    }
    private formatField(line: string): string {
        const replacements: Array<[RegExp, string]> = [
            [/:\s*/g, ": "],
            [/,\s*/g, ", "],
            [/,\s*$/, ","],
        ];
        return WitFormatter.replaceAll(line, replacements);
    }
}
