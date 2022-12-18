import { assert } from "chai";
import { GrpcSymbol, NamespacedSymbol, SymbolType } from "../../src/GRPCDefinitionTranslator";

describe("NamespacedSymbol.FromString test", () => {
	it("Should convert only class name correctly", () => {
		const _symbol = NamespacedSymbol.FromString("foo", SymbolType.Field);
		assert.equal(_symbol.namespace.length, 0, "No namespaces should be found");
		assert.equal(_symbol.name.name, "foo", "Class name should be foo");
	});
	it("Should convert 2 namespaces and 1 class name correctly", () => {
		const _symbol = NamespacedSymbol.FromString("foo.bar.baz", SymbolType.Field);
		assert.equal(_symbol.namespace.length, 2, "2 namespaces should be found");
		assert.equal(_symbol.namespace[0].name, "foo", "First namespace should be 'foo'");
		assert.equal(_symbol.namespace[1].name, "bar", "Second namespace should be 'bar'");
		assert.equal(_symbol.name.name, "baz", "the class name should be 'baz'");
	});
});




describe("GrpcSymbol.Decompose test", () => {
	const examples = [
		{name: "FooBarBaz", expected: ["foo", "bar", "baz"]},
		{name: "æøåÆøåØåæøÅøæ", expected: ["æøå", "æøå", "øåæø", "åøæ"]},
		{name: "PascalCase", expected: ["pascal", "case"]},
		{name: "SCREAMING_SNAKE_CASE", expected: ["screaming", "snake", "case"]},
		{name: "snake_case", expected: ["snake", "case"]},
		{name: "Snakey_Pascal_Case", expected: ["snakey", "pascal", "case"]},
		{name: "InconsistentCasing_example", expected: ["inconsistent", "casing", "example"]},
		{name: "testingName_CasingTest", expected: ["testing", "name", "casing", "test"]},
	];
	it("Should decompose correctly", () => {
		for (const example of examples) {
			assert.deepEqual((new GrpcSymbol(example.name, SymbolType.Field)).Decompose(), example.expected);
		}
	});
});
