import { describe, it, expect, vi } from "vitest";
import { WitFormatter } from "../src/formatter.js";

vi.mock("vscode", () => ({}));

describe("WitFormatter — edge cases", () => {
    const formatter = new WitFormatter();
    const defaultOptions = { insertSpaces: true, tabSize: 4 };

    describe("empty and whitespace input", () => {
        it("should handle empty string", () => {
            expect(formatter.formatWitContent("", defaultOptions)).toBe("");
        });

        it("should preserve blank lines", () => {
            const input = "\n\n\n";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toBe("\n\n\n");
        });

        it("should handle single blank line", () => {
            const input = "\n";
            expect(formatter.formatWitContent(input, defaultOptions)).toBe("\n");
        });
    });

    describe("tab indentation", () => {
        it("should use tabs when insertSpaces is false", () => {
            const input = "package foo:bar;\n\ninterface test {\nmy-func: func();\n}";
            const result = formatter.formatWitContent(input, { insertSpaces: false, tabSize: 4 });
            expect(result).toContain("\tmy-func: func();");
        });

        it("should respect tabSize setting", () => {
            const input = "package foo:bar;\n\ninterface test {\nmy-func: func();\n}";
            const result2 = formatter.formatWitContent(input, { insertSpaces: true, tabSize: 2 });
            expect(result2).toContain("  my-func: func();");

            const result4 = formatter.formatWitContent(input, { insertSpaces: true, tabSize: 4 });
            expect(result4).toContain("    my-func: func();");
        });
    });

    describe("nested structures", () => {
        it("should handle deeply nested braces", () => {
            const input =
                "package foo:bar;\n\nworld my-world {\nexport run: func();\nimport log: func(msg: string);\n}";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toContain("    export run: func();");
            expect(result).toContain("    import log: func(msg: string);");
        });

        it("should format resource with methods", () => {
            const input =
                "package foo:bar;\n\ninterface api {\nresource my-res {\nconstructor(name: string);\nget-name: func() -> string;\n}\n}";
            const result = formatter.formatWitContent(input, defaultOptions);
            // Resource body should be indented within interface
            const lines = result.split("\n");
            const constructorLine = lines.find((l: string) => l.includes("constructor"));
            expect(constructorLine).toBeDefined();
            expect(constructorLine!.startsWith("        ")).toBe(true); // 8 spaces (2 levels)
        });
    });

    describe("comment handling", () => {
        it("should preserve single-line comments at correct indentation", () => {
            const input = "package foo:bar;\n\ninterface test {\n// A comment\nmy-func: func();\n}";
            const result = formatter.formatWitContent(input, defaultOptions);
            const lines = result.split("\n");
            const commentLine = lines.find((l: string) => l.includes("// A comment"));
            expect(commentLine).toBeDefined();
            expect(commentLine!.startsWith("    ")).toBe(true);
        });

        it("should handle doc comments (///)", () => {
            const input = "package foo:bar;\n\ninterface test {\n/// Doc comment\nmy-func: func();\n}";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toContain("/// Doc comment");
        });
    });

    describe("type alias formatting", () => {
        it("should format simple type aliases", () => {
            const input = "type  my-type  =  u32 ;";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toBe("type my-type = u32;");
        });

        it("should format type alias with complex type", () => {
            const input = "type  my-type  =  list<u8> ;";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toBe("type my-type = list<u8>;");
        });
    });

    describe("use statement formatting", () => {
        it("should format use statements", () => {
            const input = "use   my-interface.{type1,  type2}  ;";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toContain("use my-interface");
            expect(result.endsWith(";")).toBe(true);
        });

        it("should format use with as clause", () => {
            const input = "use   my-interface.{type1}   as   alias-name ;";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toContain(" as ");
        });
    });

    describe("function formatting edge cases", () => {
        it("should format function with no parameters", () => {
            const input = "my-func:func();";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toBe("my-func: func();");
        });

        it("should format function with return type", () => {
            const input = "my-func:func()->string;";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toBe("my-func: func() -> string;");
        });

        it("should format function with multiple parameters", () => {
            const input = "my-func:func(a:u32,b:string)->bool;";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toBe("my-func: func(a: u32, b: string) -> bool;");
        });
    });

    describe("enum and flags formatting", () => {
        it("should format enum with cases", () => {
            const input = "package foo:bar;\n\nenum  my-enum  {\ncase-a,\ncase-b,\n}";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toContain("enum my-enum {");
            expect(result).toContain("    case-a,");
        });

        it("should format flags with members", () => {
            const input = "package foo:bar;\n\nflags  my-flags  {\nflag-a,\nflag-b,\n}";
            const result = formatter.formatWitContent(input, defaultOptions);
            expect(result).toContain("flags my-flags {");
            expect(result).toContain("    flag-a,");
        });
    });

    describe("provideDocumentFormattingEdits", () => {
        it("should return empty array when content is unchanged", () => {
            const mockDocument = {
                getText: () => "package foo:bar;",
                positionAt: (offset: number) => ({ line: 0, character: offset }),
            } as unknown as import("vscode").TextDocument;

            const result = formatter.provideDocumentFormattingEdits(mockDocument, defaultOptions);
            expect(result).toEqual([]);
        });
    });

    describe("multiline function parameters", () => {
        it("should indent continuation lines of func parameters", () => {
            const input = "package foo:bar;\n\ninterface test {\nmy-func: func(\na: u32,\nb: string,\n) -> bool;\n}";
            const result = formatter.formatWitContent(input, defaultOptions);
            const lines = result.split("\n");
            const paramLine = lines.find((l: string) => l.includes("a: u32"));
            expect(paramLine).toBeDefined();
            // Should be indented more than the func line
            const funcLine = lines.find((l: string) => l.includes("my-func"));
            expect(funcLine).toBeDefined();
            const funcIndent = funcLine!.length - funcLine!.trimStart().length;
            const paramIndent = paramLine!.length - paramLine!.trimStart().length;
            expect(paramIndent).toBeGreaterThan(funcIndent);
        });
    });
});
