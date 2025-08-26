import { describe, it, expect, vi } from "vitest";
import { WitFormatter } from "../src/formatter.js";

// Mock VS Code API
vi.mock("vscode", () => ({
    TextEdit: {
        replace: vi.fn((range, newText) => ({ range, newText })),
    },
    Range: vi.fn((startLine, startChar, endLine, endChar) => ({
        start: { line: startLine, character: startChar },
        end: { line: endLine, character: endChar },
    })),
    Position: vi.fn((line, character) => ({ line, character })),
    Uri: {
        parse: vi.fn((uri) => ({ toString: () => uri })),
    },
    EndOfLine: {
        LF: 1,
        CRLF: 2,
    },
}));

describe("WitFormatter", () => {
    const formatter = new WitFormatter();
    const options = {
        insertSpaces: true,
        tabSize: 4,
    };

    it("should format package declaration correctly", () => {
        const input = "package   foo:bar   ;";
        const expected = "package foo:bar;";

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        const formatted = applyEdits(input, result);
        expect(formatted).toBe(expected);
    });

    it("should format interface declaration with proper indentation", () => {
        const input = `package foo:bar;

interface   test{
f1:func();
f2:func(a:u32);
f3:func()->u32;
}`;

        const expected = `package foo:bar;

interface test {
    f1: func();
    f2: func(a: u32);
    f3: func() -> u32;
}`;

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        const formatted = applyEdits(input, result);
        expect(formatted).toBe(expected);
    });

    it("should format world declaration with imports and exports", () => {
        const input = `package foo:bar;

world   test{
import   test-interface;
export   run:func();
}`;

        const expected = `package foo:bar;

world test {
    import test-interface;
    export run: func();
}`;

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        const formatted = applyEdits(input, result);
        expect(formatted).toBe(expected);
    });

    it("should format record definition with proper alignment", () => {
        const input = `package foo:bar;

interface test{
record   person{
name:string,
age:u32,
active:bool,
}
}`;

        const expected = `package foo:bar;

interface test {
    record person {
        name: string,
        age: u32,
        active: bool,
    }
}`;

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        const formatted = applyEdits(input, result);
        expect(formatted).toBe(expected);
    });

    it("should format variant definition correctly", () => {
        const input = `package foo:bar;

interface test{
variant   result{
ok(string),
error(u32),
}
}`;

        const expected = `package foo:bar;

interface test {
    variant result {
        ok(string),
        error(u32),
    }
}`;

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        const formatted = applyEdits(input, result);
        expect(formatted).toBe(expected);
    });

    it("should format function with parameters and return type", () => {
        const input = `package foo:bar;

interface test{
complex-func:func(a:u32,b:string,c:bool)->tuple<u32,string>;
}`;

        const expected = `package foo:bar;

interface test {
    complex-func: func(a: u32, b: string, c: bool) -> tuple<u32, string>;
}`;

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        const formatted = applyEdits(input, result);
        expect(formatted).toBe(expected);
    });

    it("should preserve comments and format around them", () => {
        const input = `package foo:bar;

// This is a line comment
interface test{
/// This is a doc comment
f1:func();
/* Block comment */
f2:func();
}`;

        const expected = `package foo:bar;

// This is a line comment
interface test {
    /// This is a doc comment
    f1: func();
    /* Block comment */
    f2: func();
}`;

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        const formatted = applyEdits(input, result);
        expect(formatted).toBe(expected);
    });

    it("should handle enum declarations", () => {
        const input = `package foo:bar;

interface test{
enum   status{
pending,
running,
completed,
failed,
}
}`;

        const expected = `package foo:bar;

interface test {
    enum status {
        pending,
        running,
        completed,
        failed,
    }
}`;

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        const formatted = applyEdits(input, result);
        expect(formatted).toBe(expected);
    });

    it("should handle type aliases", () => {
        const input = `package foo:bar;

interface test{
type   my-string=string;
type   my-list=list<u32>;
}`;

        const expected = `package foo:bar;

interface test {
    type my-string = string;
    type my-list = list<u32>;
}`;

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        const formatted = applyEdits(input, result);
        expect(formatted).toBe(expected);
    });

    it("should handle use statements", () => {
        const input = `package foo:bar;

interface test{
use   other:interface/types.{my-type};
use   another   as   alias;
}`;

        const expected = `package foo:bar;

interface test {
    use other:interface/types.{my-type};
    use another as alias;
}`;

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        const formatted = applyEdits(input, result);
        expect(formatted).toBe(expected);
    });

    it("should handle empty document", () => {
        const input = "";
        const expected = "";

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        const formatted = applyEdits(input, result);
        expect(formatted).toBe(expected);
    });

    it("should handle already formatted document", () => {
        const input = `package foo:bar;

interface test {
    f1: func();
    f2: func(a: u32) -> string;
}

world test-world {
    import test;
    export test;
}`;

        const result = formatter.provideDocumentFormattingEdits(createMockDocument(input), options);

        // Should return no edits for already formatted content
        expect(result).toEqual([]);
    });
});

function createMockDocument(content: string) {
    return {
        getText: () => content,
        positionAt: (offset: number) => {
            const lines = content.substring(0, offset).split("\n");
            return { line: lines.length - 1, character: lines[lines.length - 1].length };
        },
        languageId: "wit",
        uri: { toString: () => "file:///test.wit" },
        fileName: "test.wit",
        isUntitled: false,
        isDirty: false,
        isClosed: false,
        save: async () => true,
        eol: 1, // LF
        version: 1,
        lineCount: content.split("\n").length,
        lineAt: (line: number) => {
            const lines = content.split("\n");
            const text = lines[line] || "";
            return {
                lineNumber: line,
                text,
                range: { start: { line, character: 0 }, end: { line, character: text.length } },
                rangeIncludingLineBreak: { start: { line, character: 0 }, end: { line: line + 1, character: 0 } },
                firstNonWhitespaceCharacterIndex: text.search(/\S/),
                isEmptyOrWhitespace: text.trim().length === 0,
            };
        },
        offsetAt: (position: { line: number; character: number }) => {
            const lines = content.split("\n");
            let offset = 0;
            for (let i = 0; i < position.line; i++) {
                offset += lines[i].length + 1; // +1 for newline
            }
            return offset + position.character;
        },
        getWordRangeAtPosition: () => undefined,
        validateRange: (range: any) => range,
        validatePosition: (position: any) => position,
    };
}

function applyEdits(original: string, edits: any[]): string {
    if (edits.length === 0) {
        return original;
    }

    // For simplicity, assume single replacement edit (which is what our formatter returns)
    const edit = edits[0];
    return edit.newText;
}
