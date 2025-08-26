import { describe, it, expect, vi } from "vitest";
import { WitFormatter } from "../src/formatter.js";

vi.mock("vscode", () => ({}));

describe("WitFormatter", () => {
    const formatter = new WitFormatter();
    const options: { insertSpaces: boolean; tabSize: number } = { insertSpaces: true, tabSize: 2 };

    it("formats package declaration", () => {
        const input = "package   foo:bar   ;";
        const expected = "package foo:bar;";
        expect(formatter.formatWitContent(input, options)).toBe(expected);
    });

    it("formats interface block", () => {
        const input = "package foo:bar;\n\ninterface   test{\nf1:func();\nf2:func(a:u32);\nf3:func()->u32;\n}";
        const expected =
            "package foo:bar;\n\ninterface test {\n  f1: func();\n  f2: func(a: u32);\n  f3: func() -> u32;\n}";
        expect(formatter.formatWitContent(input, options)).toBe(expected);
    });

    it("formats world block", () => {
        const input = "package foo:bar;\n\nworld   test{\nimport   test-interface;\nexport   run:func();\n}";
        const expected = "package foo:bar;\n\nworld test {\n  import test-interface;\n  export run: func();\n}";
        expect(formatter.formatWitContent(input, options)).toBe(expected);
    });

    it("formats record definition", () => {
        const input =
            "package foo:bar;\n\ninterface test{\nrecord   person{\nname:string,\nage:u32,\nactive:bool,\n}\n}";
        const expected =
            "package foo:bar;\n\ninterface test {\n  record person {\n    name: string,\n    age: u32,\n    active: bool,\n  }\n}";
        expect(formatter.formatWitContent(input, options)).toBe(expected);
    });

    it("formats complex function signature", () => {
        const input =
            "package foo:bar;\n\ninterface test{\ncomplex-func:func(a:u32,b:string,c:bool)->tuple<u32,string>;\n}";
        const expected =
            "package foo:bar;\n\ninterface test {\n  complex-func: func(a: u32, b: string, c: bool) -> tuple<u32, string>;\n}";
        expect(formatter.formatWitContent(input, options)).toBe(expected);
    });

    it("preserves comments", () => {
        const input =
            "package foo:bar;\n\n// This is a line comment\ninterface test{\n/// This is a doc comment\nf1:func();\n/* Block comment */\nf2:func();\n}";
        const expected =
            "package foo:bar;\n\n// This is a line comment\ninterface test {\n  /// This is a doc comment\n  f1: func();\n  /* Block comment */\n  f2: func();\n}";
        expect(formatter.formatWitContent(input, options)).toBe(expected);
    });

    it("formats enum", () => {
        const input =
            "package foo:bar;\n\ninterface test{\nenum   status{\npending,\nrunning,\ncompleted,\nfailed,\n}\n}";
        const expected =
            "package foo:bar;\n\ninterface test {\n  enum status {\n    pending,\n    running,\n    completed,\n    failed,\n  }\n}";
        expect(formatter.formatWitContent(input, options)).toBe(expected);
    });

    it("formats type aliases", () => {
        const input = "package foo:bar;\n\ninterface test{\ntype   my-string=string;\ntype   my-list=list<u32>;\n}";
        const expected =
            "package foo:bar;\n\ninterface test {\n  type my-string = string;\n  type my-list = list<u32>;\n}";
        expect(formatter.formatWitContent(input, options)).toBe(expected);
    });

    it("formats use statements", () => {
        const input =
            "package foo:bar;\n\ninterface test{\nuse   other:interface/types.{my-type};\nuse   another   as   alias;\n}";
        const expected =
            "package foo:bar;\n\ninterface test {\n  use other:interface/types.{my-type};\n  use another as alias;\n}";
        expect(formatter.formatWitContent(input, options)).toBe(expected);
    });

    it("handles empty document", () => {
        expect(formatter.formatWitContent("", options)).toBe("");
    });

    it("is idempotent on already formatted input", () => {
        const input =
            "package foo:bar;\n\ninterface test {\n  f1: func();\n  f2: func(a: u32) -> string;\n}\n\nworld test-world {\n  import test;\n  export test;\n}";
        expect(formatter.formatWitContent(input, options)).toBe(input);
    });

    it("tuple type alias multiline indentation", () => {
        const input = "type load-store-all-sizes = future<tuple<\nstring,\nu8,\n>>;";
        const expected = "type load-store-all-sizes = future<tuple<\n  string,\n  u8,\n>>;";
        expect(formatter.formatWitContent(input, options)).toBe(expected);
    });

    it("function params multiline indentation", () => {
        const input = "interface x {\n  foo: func(\n  a: u8,\n  b: u16,\n  );\n}";
        const expected = "interface x {\n  foo: func(\n    a: u8,\n    b: u16,\n  );\n}";
        expect(formatter.formatWitContent(input, options)).toBe(expected);
    });
});
