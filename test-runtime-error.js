// Quick test to verify RuntimeError parsing
import { extractErrorInfo } from "./src/errorParser.js";

const runtimeErrorStack = `RuntimeError: unreachable
	at wasm://wasm/01e6e7ee:wasm-function[14967]:0x695217
	at wasm://wasm/01e6e7ee:wasm-function[14959]:0x694931
	at wasm://wasm/01e6e7ee:wasm-function[15077]:0x6a55c8
	at wasm://wasm/01e6e7ee:wasm-function[896]:0xeed9e
	at wasm://wasm/01e6e7ee:wasm-function[893]:0xed7fe
	at wasm://wasm/01e6e7ee:wasm-function[891]:0xec85c
	at wasm://wasm/01e6e7ee:wasm-function[874]:0xe6623
	at wasm://wasm/01e6e7ee:wasm-function[16]:0x50a91
	at wasm://wasm/01e6e7ee:wasm-function[21]:0x554ac
	at generateTypes (file:///home/gordon/vscode-wit/dist/extension.js:28592:15)
	at typesComponent (file:///home/gordon/vscode-wit/dist/extension.js:28853:14)
	at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
	at async WitSyntaxValidator.validate (file:///home/gordon/vscode-wit/dist/extension.js:28946:7)
	at async syntaxCheckCurrentFile (file:///home/gordon/vscode-wit/dist/extension.js:29094:23)
	at async file:///home/gordon/vscode-wit/dist/extension.js:29062:9`;

const result = extractErrorInfo(runtimeErrorStack);
console.log("Parsed RuntimeError:", result);
