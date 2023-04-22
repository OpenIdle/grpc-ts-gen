/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { TSCodeWriter, TSCodeWriterOptions } from "../../src/TSCodeWriter";
import { TypeGenerator } from "../../src/TypeGenerator";
import { MockGrpcServerImplementation, MockNamingTransformer } from "../helper";
import * as ts from "typescript";
import { assert } from "chai";
import { dirname, join } from "path/posix";
import { mkdirSync, writeFileSync } from "fs";
import { SymbolType } from "../../src/GRPCDefinitionTranslator";
import { GrpcResponseError } from "../../src";
import * as grpc from "@grpc/grpc-js";
import { mkdir } from "fs/promises";

async function CompileTsProgram(path: string, filenames: string[]): Promise<void> {
	//compile the generated code using the typescript compiler and put the output into dist/dynamic-sample
	const program = ts.createProgram(filenames.map(x => join(path, x)), {
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
}

describe("DynamicTest", () => {
	const rbaoOptions: TSCodeWriterOptions = {
		serverName: "DynamicTestRbao",
		requestBodyAsParameters: false,
		module: false
	};

	const rbapOptions: TSCodeWriterOptions = {
		serverName: "DynamicTestRbap",
		requestBodyAsParameters: true,
		module: false
	};


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

		await mkdir("dynamic-test", {recursive: true});

		const codeWriter = new TypeGenerator(new TSCodeWriter(namingTransformer, rbaoOptions, "./../../src"));
		const vd = await codeWriter.Create("test/data/dynamicsample/");
		await vd.WriteVirtualDirectory("dynamic-test/rbao");

		const codeWriterRbap = new TypeGenerator(new TSCodeWriter(namingTransformer, rbapOptions, "./../../src"));
		const vdRbap = await codeWriterRbap.Create("test/data/dynamicsample/");
		await vdRbap.WriteVirtualDirectory("dynamic-test/rbap");
		

		await CompileTsProgram("dynamic-test/rbao", Array.from(vd.GetFlatEntries().keys()));
		await CompileTsProgram("dynamic-test/rbap", Array.from(vdRbap.GetFlatEntries().keys()));
	},);
	it("Should be able to include the generated files", async () => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		await import("./../../dynamic-test/rbao/DynamicTestRbaoServer" + "");
		await import("./../../dynamic-test/rbap/DynamicTestRbapServer" + "");
	});

	it("Should be able to construct server", async () => {
		const {DynamicTestRbaoServer} = await import("./../../dynamic-test/rbao/DynamicTestRbaoServer" + "");
		const {DynamicTestRbapServer} = await import("./../../dynamic-test/rbap/DynamicTestRbapServer" + "");
		new DynamicTestRbaoServer(new MockGrpcServerImplementation());
		new DynamicTestRbapServer(new MockGrpcServerImplementation());
	});

	it("Should be able to add a service", async () => {
		const {DynamicTestRbaoServer} = await import("./../../dynamic-test/rbao/DynamicTestRbaoServer" + "");
		const {SimpleEnumEnum} = await import("./../../dynamic-test/rbao/testNamespace/dataNamespace/servicesamplesNamespace" + "");
		const testServer = new DynamicTestRbaoServer(new MockGrpcServerImplementation());
		testServer.AddtestNamespacedataNamespaceservicesamplesNamespaceSimpleService({
			method1Procedure: async (request: any) => {
				return {
					"someNumber": request.someNumber,
					"signedNumber": request.signedNumber,
					"username": request.username,
					"anotherString": request.anotherString,
					"someEnumField": SimpleEnumEnum.VALUE44
				};
			}
		});
		const {DynamicTestRbapServer} = await import("./../../dynamic-test/rbap/DynamicTestRbapServer" + "");
		const testServer2 = new DynamicTestRbapServer(new MockGrpcServerImplementation());
		testServer2.AddtestNamespacedataNamespaceservicesamplesNamespaceSimpleService({
			method1Procedure: async (anotherString: string, signedNumber: number, someEnum: typeof SimpleEnumEnum, someNumber: number, username: string) => {
				return {
					"someNumber": someNumber,
					"signedNumber": signedNumber,
					"username": username,
					"anotherString": anotherString,
					"someEnumField": someEnum
				};
			}
		});
	});

	it("Should be able to use a service", async () => {
		const {DynamicTestRbaoServer} = await import("./../../dynamic-test/rbao/DynamicTestRbaoServer" + "");
		const {SimpleEnumEnum} = await import("./../../dynamic-test/rbao/testNamespace/dataNamespace/servicesamplesNamespace" + "");
		const mockGrpcServer = new MockGrpcServerImplementation();
		const testServer = new DynamicTestRbaoServer(mockGrpcServer);
		let receivedRequestObject = {};
		testServer.AddtestNamespacedataNamespaceservicesamplesNamespaceSimpleService({
			method1Procedure: async (request: any) => {
				receivedRequestObject = request;
				return {
					"someNumberField": request.someNumberField + 1,
					"signedNumberField": request.signedNumberField + 1,
					"usernameField": request.usernameField + "baz",
					"anotherStringField": request.anotherStringField + " ipsum"
				};
			}
		});

		const response = await mockGrpcServer.mockCall("/test.data.servicesamples.SimpleService/method1", {
			"someNumber": 42,
			"signedNumber": 54,
			"username": "foobar",
			"anotherString": "lorem",
			"someEnum": SimpleEnumEnum.VALUE323
		});

		assert.deepEqual(receivedRequestObject, {
			"someNumberField": 42,
			"signedNumberField": 54,
			"usernameField": "foobar",
			"anotherStringField": "lorem",
			"someEnumField": SimpleEnumEnum.VALUE323
		});

		assert.deepEqual(response.response, {
			"someNumber": 43,
			"signedNumber": 55,
			"username": "foobarbaz",
			"anotherString": "lorem ipsum",
		}, "Response should be correct");
	});

	it("Should be able to use request object as parameter server", async () => {
		const {DynamicTestRbapServer} = await import("./../../dynamic-test/rbap/DynamicTestRbapServer" + "");
		const {SimpleEnumEnum} = await import("./../../dynamic-test/rbao/testNamespace/dataNamespace/servicesamplesNamespace" + "");
		const mockGrpcServer = new MockGrpcServerImplementation();
		const testServer = new DynamicTestRbapServer(mockGrpcServer);
		let receivedRequestValues: any[] = [];
		testServer.AddtestNamespacedataNamespaceservicesamplesNamespaceSimpleService({
			method1Procedure: async (username: string, someNumber: string, signedNumber: number, anotherString: string, someEnum: typeof SimpleEnumEnum) => {
				receivedRequestValues = [username, someNumber, signedNumber, anotherString, someEnum];
				return {
					"someNumberField": someNumber + 1,
					"signedNumberField": signedNumber + 1,
					"usernameField": username + "baz",
					"anotherStringField": anotherString + " ipsum"
				};
			}
		});

		const response = await mockGrpcServer.mockCall("/test.data.servicesamples.SimpleService/method1", {
			"someNumber": 42,
			"signedNumber": 54,
			"username": "foobar",
			"anotherString": "lorem",
			"someEnum": SimpleEnumEnum.VALUE323
		});

		assert.deepEqual(receivedRequestValues, ["foobar", 42, 54, "lorem", SimpleEnumEnum.VALUE323]);

		assert.deepEqual(response.response, {
			"someNumber": 43,
			"signedNumber": 55,
			"username": "foobarbaz",
			"anotherString": "lorem ipsum",
		}, "Response should be correct");
	});

	it("Should catch errors correctly", async () => {
		const {DynamicTestRbaoServer} = await import("./../../dynamic-test/rbao/DynamicTestRbaoServer" + "");
		const mockGrpcServer = new MockGrpcServerImplementation();
		const testServer = new DynamicTestRbaoServer(mockGrpcServer);
		testServer.AddtestNamespacedataNamespaceservicesamplesNamespacenestedNamespaceSimpleService2({
			method1Procedure: async () => {
				throw new GrpcResponseError("Some error", grpc.status.INVALID_ARGUMENT);
			}
		});
		const response = await mockGrpcServer.mockCall("/test.data.servicesamples.nested.SimpleService2/method1", {
			"username": "foobar"
		});

		assert.deepEqual(response, {err: {code: grpc.status.INVALID_ARGUMENT}}, "Error should be correct");
	});

	it("Should be able to use oneof fields", async () => {
		const {DynamicTestRbaoServer} = await import("./../../dynamic-test/rbao/DynamicTestRbaoServer" + "");
		const {SimpleEnumEnum} = await import("./../../dynamic-test/rbao/testNamespace/dataNamespace/servicesamplesNamespace" + "");
		const mockGrpcServer = new MockGrpcServerImplementation();
		const testServer = new DynamicTestRbaoServer(mockGrpcServer);
		let receivedRequestValues: any = {};
		testServer.AddtestNamespacedataNamespaceservicesamplesNamespaceSimpleService({
			method2Procedure: async (obj: any) => {
				receivedRequestValues = obj;
				return {
					oneofFieldField: {
						simpleResponseField: {
							usernameField: "foo",
							someNumberField: 123,
							signedNumberField: 34,
							anotherStringField: "anotherfoo"
						}
					},
				};
			}
		});

		const response = await mockGrpcServer.mockCall("/test.data.servicesamples.SimpleService/method2", {
			oneofField: {
				name: undefined,
				num: undefined,
				simpleRequest: {
					username: "foobar",
					someNumber: 3,
					signedNumber: 45,
					anotherString: "barbaz",
					someEnum: SimpleEnumEnum.VALUE323
				}
			},
			nestedMessage: {
				hello: "bar"
			}
		});

		assert.deepEqual(receivedRequestValues, {
			oneofFieldField: {
				nameField: undefined,
				numField: undefined,
				simpleRequestField: {
					usernameField: "foobar",
					someNumberField: 3,
					signedNumberField: 45,
					anotherStringField: "barbaz",
					someEnumField: SimpleEnumEnum.VALUE323
				}
			},
			nestedMessageField: {
				helloField: "bar",
			},
			optionalFieldField: undefined
		});

		assert.deepEqual(response.response, {
			oneofField: {
				bob: undefined,
				bobother: undefined,
				simpleResponse: {
					username: "foo",
					someNumber: 123,
					signedNumber: 34,
					anotherString: "anotherfoo"
				}
			},
			optionalField: undefined
		}, "Response should be correct");
	});

	it("Should be able to use oneof fields with request body as parameters", async () => {
		const {DynamicTestRbapServer} = await import("./../../dynamic-test/rbap/DynamicTestRbapServer" + "");
		const {SimpleEnumEnum} = await import("./../../dynamic-test/rbap/testNamespace/dataNamespace/servicesamplesNamespace" + "");
		const mockGrpcServer = new MockGrpcServerImplementation();
		const testServer = new DynamicTestRbapServer(mockGrpcServer);
		let receivedRequestValues: any = [];
		testServer.AddtestNamespacedataNamespaceservicesamplesNamespaceSimpleService({
			method2Procedure: async (...args: any[]) => {
				receivedRequestValues = args;
				return {
					oneofFieldField: {
						simpleResponseField: {
							usernameField: "foo",
							someNumberField: 123,
							signedNumberField: 34,
							anotherStringField: "anotherfoo"
						}
					},
					optionalFieldField: "hello"
				};
			}
		});

		const response = await mockGrpcServer.mockCall("/test.data.servicesamples.SimpleService/method2", {
			nestedMessage: {
				hello: "bar"
			},
			oneofField: {
				name: undefined,
				num: undefined,
				simpleRequest: {
					username: "foobar",
					someNumber: 3,
					signedNumber: 45,
					anotherString: "barbaz",
					someEnum: SimpleEnumEnum.VALUE323
				}
			}
		});

		assert.deepEqual(receivedRequestValues, [
			{
				nameField: undefined,
				numField: undefined,
				simpleRequestField: {
					usernameField: "foobar",
					someNumberField: 3,
					signedNumberField: 45,
					anotherStringField: "barbaz",
					someEnumField: SimpleEnumEnum.VALUE323
				}
			},
			{
				helloField: "bar"
			},
			undefined
		]);

		assert.deepEqual(response.response, {
			oneofField: {
				bob: undefined,
				bobother: undefined,
				simpleResponse: {
					username: "foo",
					someNumber: 123,
					signedNumber: 34,
					anotherString: "anotherfoo"
				}
			},
			optionalField: "hello"
		}, "Response should be correct");
	});

	it("Optional fields should be correct", async () => {
		const {DynamicTestRbapServer} = await import("./../../dynamic-test/rbap/DynamicTestRbapServer" + "");
		const mockGrpcServer = new MockGrpcServerImplementation();
		const testServer = new DynamicTestRbapServer(mockGrpcServer);
		let receivedRequestValues: any[] = [];
		testServer.AddtestNamespacedataNamespaceservicesamplesNamespaceSimpleService({
			method3Procedure: async (...args: any[]) => {
				receivedRequestValues = args;
				return {
					helloField: "hello",
					bobField: "ok"
				};
			}
		});

		const response = await mockGrpcServer.mockCall("/test.data.servicesamples.SimpleService/method3", {
			hello: "hello",
			bob: "ok"
		});
		
		assert.deepEqual(response.response, {
			hello: "hello",
			bob: "ok"
		});

		assert.deepEqual(receivedRequestValues, [
			"hello",
			"ok"
		]);
	});
});
