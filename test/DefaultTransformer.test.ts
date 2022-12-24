import { assert } from "chai";
import { DefaultTransformer } from "../src/DefaultTransformer";
import { GrpcSymbol, SymbolType } from "../src/GRPCDefinitionTranslator";
import { INamingTransformer } from "../src/INamingTransformer";

function TestSymbolConversion(transformer: INamingTransformer, froms: string[], to: string, type: SymbolType): void {
	for (const from of froms) {
		assert.equal(transformer.ConvertSymbol(new GrpcSymbol(from, type)), to, `${from} should become ${to}`);
	}
}

describe("DefaultTransformer tests", () => {
	const TEST_CASES = ["test_case", "testCase", "TestCase", "TEST_CASE"];
	it("should transform enum to PascalCase", () => {
		const transformer = new DefaultTransformer();
		TestSymbolConversion(transformer, TEST_CASES, "TestCase", SymbolType.Enum);
	});
	it("Should transform enum value to PascalCase", () => {
		const transformer = new DefaultTransformer();
		TestSymbolConversion(transformer, TEST_CASES, "TestCase", SymbolType.EnumValue);
	});
	it("should transform field to camel case", () => {
		const transformer = new DefaultTransformer();
		TestSymbolConversion(transformer, TEST_CASES, "testCase", SymbolType.Field);
	});
	it("should transform message to PascalCase", () => {
		const transformer = new DefaultTransformer();
		TestSymbolConversion(transformer, TEST_CASES, "TestCase", SymbolType.Message);
	});
	it("should transform namespace to PascalCase", () => {
		const transformer = new DefaultTransformer();
		TestSymbolConversion(transformer, TEST_CASES, "TestCase", SymbolType.Namespace);
	});
	it("should transform procedure to PascalCase", () => {
		const transformer = new DefaultTransformer();
		TestSymbolConversion(transformer, TEST_CASES, "TestCase", SymbolType.Procedure);
	});
	it("should transform service to IPascalCase", () => {
		const transformer = new DefaultTransformer();
		TestSymbolConversion(transformer, TEST_CASES, "ITestCase", SymbolType.Service);
	});
	it("should not transform special symbols", () => {
		const transformer = new DefaultTransformer();
		assert.equal(transformer.ConvertSymbol(new GrpcSymbol("test_service", SymbolType.Special)), "test_service", "snake case not be transformed");
		assert.equal(transformer.ConvertSymbol(new GrpcSymbol("testService", SymbolType.Special)), "testService", "camel case should not be transformed");
		assert.equal(transformer.ConvertSymbol(new GrpcSymbol("TestService", SymbolType.Special)), "TestService", "pascal case should not be transformed");
		assert.equal(transformer.ConvertSymbol(new GrpcSymbol("TEST_SERVICE", SymbolType.Special)), "TEST_SERVICE", "screaming snake case should not be transformed");
	});
	it("should throw on unknown symbol type", () => {
		const transformer = new DefaultTransformer();
		assert.throws(() => transformer.ConvertSymbol(new GrpcSymbol("test", Number.MAX_SAFE_INTEGER as SymbolType)), "Should throw when an unknown symbol type is used");
	});
});
