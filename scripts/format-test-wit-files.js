#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function replaceAllSeq(line, replacements) {
    let out = line;
    for (const [re, repl] of replacements) out = out.replace(re, repl);
    return out;
}
function ensureSemicolon(line) {
    return line.replace(/\s*;\s*$/, ";");
}
function collapseSpaces(line) {
    return line.replace(/\s+/g, " ");
}

function isOpeningBrace(line) {
    return line.endsWith("{") && !line.includes("}");
}

function formatFunc(line) {
    const replacements = [
        [/:func/, ": func"],
        [/:\s*func/, ": func"],
        [/func\s*\(/, "func("],
        [/\)\s*->\s*/, ") -> "],
        [/\)->\s*/, ") -> "],
        [/\)->/, ") -> "],
        [/,\s*/g, ", "],
        [/:\s*/g, ": "],
    ];
    return ensureSemicolon(replaceAllSeq(line, replacements));
}
function formatPackage(line) {
    return ensureSemicolon(collapseSpaces(line));
}
function formatNamedBlock(line) {
    return collapseSpaces(line).replace(/\s*{\s*$/, " {");
}
function formatImportExport(line) {
    const base = line.replace(/^(import|export)\s+/, "$1 ");
    return base.includes(": func") || base.includes(":func") ? formatFunc(base) : ensureSemicolon(base);
}
function formatUse(line) {
    const repl = [
        [/^use\s+/, "use "],
        [/\s+as\s+/, " as "],
        [/\s+from\s+/, " from "],
    ];
    return ensureSemicolon(replaceAllSeq(line, repl));
}
function formatTypeAlias(line) {
    const repl = [
        [/^type\s+/, "type "],
        [/\s*=\s*/, " = "],
    ];
    return ensureSemicolon(replaceAllSeq(line, repl));
}
function formatField(line) {
    return replaceAllSeq(line, [
        [/::?/g, (m) => (m.endsWith(":") ? ": " : m)],
        [/:\s*/g, ": "],
        [/,\s*/g, ", "],
        [/,\s*$/, ","],
    ]);
}
function isTypeDecl(line) {
    return /^(record|variant|enum|flags|resource)\s+/.test(line);
}
function isFuncDecl(line) {
    if (line.startsWith("import ") || line.startsWith("export ")) return false;
    return /^[a-zA-Z][\w-]*\s*:\s*func\b/.test(line) || /:\s*func\b/.test(line) || /->/.test(line);
}
function isFieldDecl(line) {
    const t = line.trim();
    return /^[a-zA-Z][a-zA-Z0-9-]*\s*[:,(]/.test(t) || /^[a-zA-Z][a-zA-Z0-9-]*\s*,?\s*$/.test(t);
}

function formatLine(line) {
    if (line.startsWith("package ")) return formatPackage(line);
    if (line.startsWith("interface ")) return formatNamedBlock(line);
    if (line.startsWith("world ")) return formatNamedBlock(line);
    if (isTypeDecl(line)) return formatNamedBlock(line);
    if (line.startsWith("type ") && line.includes("=")) return formatTypeAlias(line);
    if (isFuncDecl(line)) return formatFunc(line);
    if (line.startsWith("import ") || line.startsWith("export ")) return formatImportExport(line);
    if (line.startsWith("use ")) return formatUse(line);
    if (isFieldDecl(line)) return formatField(line);
    return line;
}

function formatContent(content, tabSize = 2, insertSpaces = true) {
    const indentUnit = insertSpaces ? " ".repeat(tabSize) : "\t";
    const lines = content.split(/\r?\n/);
    const out = [];
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
        if (/^\}/.test(trimmed)) indentLevel = Math.max(0, indentLevel - 1);
        if (/^\/\//.test(trimmed)) {
            const extra = inMultiLineTupleAlias && aliasGenericDepth > 0 && !/^>>/.test(trimmed) ? 1 : 0;
            out.push(indentUnit.repeat(indentLevel + extra) + trimmed);
            continue;
        }
        const formattedLine = formatLine(trimmed);
        const needsTupleExtra = inMultiLineTupleAlias && aliasGenericDepth > 0 && !/^>>/.test(trimmed);
        const needsFuncParamExtra = inFuncParams && !/^\)/.test(trimmed);
        out.push(
            indentUnit.repeat(indentLevel + (needsTupleExtra ? 1 : 0) + (needsFuncParamExtra ? 1 : 0)) + formattedLine
        );
        if (isOpeningBrace(trimmed)) indentLevel++;
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
            if (activate) inFuncParams = true;
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
            if (aliasGenericDepth <= 0) inMultiLineTupleAlias = false;
        }
    }
    return out.join("\n");
}

function walk(dir, acc) {
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full, acc);
        else if (entry.endsWith(".wit")) acc.push(full);
    }
    return acc;
}

const root = path.resolve("tests");
if (!fs.existsSync(root)) {
    console.error("tests directory not found");
    process.exit(1);
}
const files = walk(root, []);
let changed = 0;
for (const f of files) {
    const original = fs.readFileSync(f, "utf8");
    const formatted = formatContent(original);
    if (formatted !== original) {
        fs.writeFileSync(f, formatted, "utf8");
        changed++;
        console.log("Formatted", path.relative(process.cwd(), f));
    }
}
console.log(`Processed ${files.length} .wit files. Changed ${changed}.`);
