import { describe, it, expect } from "vitest";
import { extractErrorInfo } from "../src/errorParser.js";

/**
 * Test data - WIT error stack samples for testing the regex
 */
const testSampleStacks = [
    `Error: reading WIT file at [/home/gordon/vscode-wit/tests/grammar/integration/floats.wit]

Caused by:
    expected '{', found keyword \`interface\`
         --> /home/gordon/vscode-wit/tests/grammar/integration/floats.wit:3:1
          |
        3 | interface floats {
          | ^
	at generateTypes (file:///home/gordon/vscode-wit/node_modules/@bytecodealliance/jco/obj/js-component-bindgen-component.js:4125:11)
	at typesComponent (file:///home/gordon/vscode-wit/node_modules/@bytecodealliance/jco/src/cmd/transpile.js:118:17)
	at async WitSyntaxValidator.validate (/home/gordon/vscode-wit/dist/extension.js:48:19)
`,
    `Error: reading WIT file at [/home/gordon/vscode-wit/tests/grammar/integration/integers.wit]

Caused by:
    expected '{', found keyword \`interface\`
         --> /home/gordon/vscode-wit/tests/grammar/integration/integers.wit:3:1
          |
        3 | interface integers {
          | ^
	at generateTypes (file:///home/gordon/vscode-wit/node_modules/@bytecodealliance/jco/obj/js-component-bindgen-component.js:4125:11)
	at typesComponent (file:///home/gordon/vscode-wit/node_modules/@bytecodealliance/jco/src/cmd/transpile.js:118:17)
	at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
	at async WitSyntaxValidator.validate (/home/gordon/vscode-wit/dist/extension.js:63:19)
	at async syntaxCheckCurrentFile (/home/gordon/vscode-wit/dist/extension.js:152:21)
	at async /home/gordon/vscode-wit/dist/extension.js:142:5
	at async Xb.h (file:///home/gordon/.vscode-server/bin/dfaf44141ea9deb3b4096f7cd6d24e00c147a4b1/out/vs/workbench/api/node/extensionHostProcess.js:120:41516)`,
    `Error: The main package \`test:comments\` contains no worlds
	at generateTypes (file:///home/gordon/vscode-wit/dist/extension.js:28632:11)
	at typesComponent (file:///home/gordon/vscode-wit/dist/extension.js:28853:14)
	at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
	at async WitSyntaxValidator.validate (file:///home/gordon/vscode-wit/dist/extension.js:28933:7)
	at async syntaxCheckCurrentFile (file:///home/gordon/vscode-wit/dist/extension.js:29078:23)
	at async file:///home/gordon/vscode-wit/dist/extension.js:29046:9`,
];

describe("WIT Error Parser", () => {
    describe("extractErrorInfo", () => {
        it("should extract error info from first sample stack", () => {
            const result = extractErrorInfo(testSampleStacks[0]);

            expect(result).not.toBeNull();
            expect(result?.mainError).toBe(
                "reading WIT file at [/home/gordon/vscode-wit/tests/grammar/integration/floats.wit]"
            );
            expect(result?.detailedError).toBe("expected '{', found keyword `interface`");
            expect(result?.filePath).toBe("/home/gordon/vscode-wit/tests/grammar/integration/floats.wit");
            expect(result?.row).toBe(3);
            expect(result?.column).toBe(1);
        });

        it("should extract error info from second sample stack", () => {
            const result = extractErrorInfo(testSampleStacks[1]);

            expect(result).not.toBeNull();
            expect(result?.mainError).toBe(
                "reading WIT file at [/home/gordon/vscode-wit/tests/grammar/integration/integers.wit]"
            );
            expect(result?.detailedError).toBe("expected '{', found keyword `interface`");
            expect(result?.filePath).toBe("/home/gordon/vscode-wit/tests/grammar/integration/integers.wit");
            expect(result?.row).toBe(3);
            expect(result?.column).toBe(1);
        });

        it("should extract error info from third sample stack (error without file location)", () => {
            const result = extractErrorInfo(testSampleStacks[2]);

            expect(result).not.toBeNull();
            expect(result?.mainError).toBe("The main package `test:comments` contains no worlds");
            expect(result?.detailedError).toBeUndefined();
            expect(result?.filePath).toBeUndefined();
            expect(result?.row).toBeUndefined();
            expect(result?.column).toBeUndefined();
        });

        it("should return null for invalid error stack", () => {
            const invalidStack = "This is not a valid WIT error stack";
            const result = extractErrorInfo(invalidStack);

            expect(result).toBeNull();
        });

        it('should handle error stack without "Caused by" section', () => {
            const stackWithoutCausedBy = `Error: some error message
         --> /path/to/file.wit:5:10
          |
        5 | some code
          | ^`;

            const result = extractErrorInfo(stackWithoutCausedBy);

            expect(result).not.toBeNull();
            expect(result?.mainError).toBe("some error message");
            expect(result?.detailedError).toBeUndefined();
            expect(result?.filePath).toBe("/path/to/file.wit");
            expect(result?.row).toBe(5);
            expect(result?.column).toBe(10);
        });

        it("should handle different file paths correctly", () => {
            const customStack = `Error: reading WIT file at [/custom/path/test.wit]

Caused by:
    syntax error
         --> /custom/path/test.wit:15:25
          |
       15 | invalid syntax here
          | ^`;

            const result = extractErrorInfo(customStack);

            expect(result).not.toBeNull();
            expect(result?.filePath).toBe("/custom/path/test.wit");
            expect(result?.row).toBe(15);
            expect(result?.column).toBe(25);
        });

        it("should handle edge case with large line and column numbers", () => {
            const edgeCaseStack = `Error: parsing error

Caused by:
    unexpected token
         --> /some/file.wit:9999:888
          |
     9999 | some code
          | ^`;

            const result = extractErrorInfo(edgeCaseStack);

            expect(result).not.toBeNull();
            expect(result?.row).toBe(9999);
            expect(result?.column).toBe(888);
        });

        it("should verify regex pattern correctness with simple cases", () => {
            const testCases = [
                {
                    input: "Error: test --> /file.wit:1:2",
                    expected: { mainError: "test", filePath: "/file.wit", row: 1, column: 2 },
                },
                {
                    input: "Error: single line error --> /path/file.wit:10:5",
                    expected: { mainError: "single line error", filePath: "/path/file.wit", row: 10, column: 5 },
                },
            ];

            testCases.forEach((testCase, index) => {
                const result = extractErrorInfo(testCase.input);
                expect(result, `Test case ${index + 1} should match`).not.toBeNull();
                expect(result?.mainError?.trim(), `Test case ${index + 1} main error`).toBe(
                    testCase.expected.mainError
                );
                expect(result?.filePath, `Test case ${index + 1} file path`).toBe(testCase.expected.filePath);
                expect(result?.row, `Test case ${index + 1} row`).toBe(testCase.expected.row);
                expect(result?.column, `Test case ${index + 1} column`).toBe(testCase.expected.column);
            });
        });

        it("should extract all components correctly from original samples", () => {
            testSampleStacks.forEach((stack, index) => {
                const result = extractErrorInfo(stack);

                expect(result, `Sample ${index + 1} should match`).not.toBeNull();

                // Verify the extracted information is reasonable
                expect(result?.mainError?.length, "Main error should not be empty").toBeGreaterThan(0);

                if (index < 2) {
                    // First two samples have detailed error and file location
                    expect(result?.detailedError?.length, "Detailed error should not be empty").toBeGreaterThan(0);
                    expect(result?.filePath, "File path should contain .wit").toContain(".wit");
                    expect(result?.row, "Row should be positive").toBeGreaterThan(0);
                    expect(result?.column, "Column should be positive").toBeGreaterThan(0);

                    // Check specific expected values
                    if (index === 0) {
                        expect(result?.filePath).toContain("floats.wit");
                    } else if (index === 1) {
                        expect(result?.filePath).toContain("integers.wit");
                    }

                    expect(result?.row).toBe(3);
                    expect(result?.column).toBe(1);
                } else {
                    // Third sample has no detailed error or file location
                    expect(result?.detailedError).toBeUndefined();
                    expect(result?.filePath).toBeUndefined();
                    expect(result?.row).toBeUndefined();
                    expect(result?.column).toBeUndefined();
                }
            });
        });
    });
});
