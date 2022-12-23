/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { TSCodeWriter } from "../../src/TSCodeWriter";
import { TypeGenerator } from "../../src/TypeGenerator";
import { MockGrpcServerImplementation, MockNamingTransformer } from "../helper";
import * as ts from "typescript";
import { assert } from "chai";
import { dirname, join } from "path";
import { mkdirSync, writeFileSync } from "fs";
import { SymbolType } from "../../src/GRPCDefinitionTranslator";

describe("DynamicTest", () => {
	const ServerName = "DynamicTest";
	before(async function() {
		this.timeout(20000);
		const namingTransformer = new MockNamingTransformer((symbol) => {
			switch (symbol.type) {
				case SymbolType.Enum:
					return symbol.name + "Enum";
				case SymbolType.Message:
					return symbol.name + "Message";
				case SymbolType.Namespace:
					return symbol.name + "Namespace";
				case SymbolType.Field:
					return symbol.name + "Field";
				case SymbolType.Procedure:
					return symbol.name + "Procedure";
				default:
					return symbol.name;
			}
		});

		const codeWriter = new TypeGenerator(new TSCodeWriter(namingTransformer, false, ServerName, "./../src"));
		const vd = await codeWriter.Create("test/data/dynamicsample/");
		await vd.WriteVirtualDirectory("dynamic-test/");
		const filenames = Array.from(vd.GetFlatEntries().keys());
		
		//compile the generated code using the typescript compiler and put the output into dist/dynamic-sample
		const program = ts.createProgram(filenames.map(x => join("dynamic-test", x)), {
			outDir: "dist",
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.CommonJS,
			rootDir: "./"
		});
		
		//The dynamic sample includes will include the helper module directly from the src folder
		//therefore we need to avoid compiling the files from the src folder aince they should 
		//be compiled already
		const emitResult = program.emit(undefined, (fileName, text) => {
			mkdirSync(dirname(fileName), {recursive: true});
			if (fileName.startsWith("dist/dynamic-test/")) {
				writeFileSync(fileName, text, {encoding: "utf8"});
			}
		});
		
		const allDiagnostic = ts
			.getPreEmitDiagnostics(program)
			.concat(emitResult.diagnostics);
		
		const errorMessages: string[] = [];

		allDiagnostic.forEach(diagnostic => {
			if (diagnostic.file) {
				if (diagnostic.start == null) {
					errorMessages.push(`${diagnostic.file.fileName}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
					return;
				}
				const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
				const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
				
				errorMessages.push(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
			} else {
				errorMessages.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
			}
		});
		if (errorMessages.length > 0)
			assert.fail(errorMessages.join("\n"));
	},);
	it("Should be able to include the generated files", async () => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		await import("./../../dynamic-test/DynamicTestServer" + "");
	});

	it("Should be able to construct server", async () => {
		const {DynamicTestServer} = await import("./../../dynamic-test/DynamicTestServer" + "");
		new DynamicTestServer(new MockGrpcServerImplementation());
	});

	it("Should be able to add a service", async () => {
		const {DynamicTestServer} = await import("./../../dynamic-test/DynamicTestServer" + "");
		const testServer = new DynamicTestServer(new MockGrpcServerImplementation());
		testServer.AddSimpleService({
			method1: async (request: any) => {
				return {
					"someNumber": request.someNumber,
					"signedNumber": request.signedNumber,
					"username": request.username,
					"anotherString": request.anotherString,
				};
			}
		});
	});

	it("Should be able to use a service", async () => {
		const {DynamicTestServer} = await import("./../../dynamic-test/DynamicTestServer" + "");
		const mockGrpcServer = new MockGrpcServerImplementation();
		const testServer = new DynamicTestServer(mockGrpcServer);
		testServer.AddSimpleService({
			method1Procedure: async (request: any) => {
				return {
					"someNumberField": request.someNumberField + 1,
					"signedNumberField": request.signedNumberField + 1,
					"usernameField": request.usernameField + "baz",
					"anotherStringField": request.anotherStringField + " ipsum",
				};
			}
		});

		const response = await mockGrpcServer.mockCall("/test.data.servicesamples.SimpleService/method1", {
			"someNumber": 42,
			"signedNumber": 54,
			"username": "foobar",
			"anotherString": "lorem",
		});

		assert.deepEqual(response.response, {
			"someNumber": 43,
			"signedNumber": 55,
			"username": "foobarbaz",
			"anotherString": "lorem ipsum",
		}, "Response should be correct");
	});
});
