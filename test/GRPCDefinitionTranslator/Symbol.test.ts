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
	const assembleSample = [
		"foo.bar.baz",
		"foo.bar",
		"foo",
		"foo..",
		".foo..",
		"...",
		".",
		"Foo_Bar.__B___az",
		"",
	];

	it("Should be able to assemble correctly", () => {
		for (const sample of assembleSample) {
			const _symbol = NamespacedSymbol.FromString(sample, SymbolType.Field);
			assert.equal(_symbol.Assemble(), sample, `Should be able to assemble ${sample}`);
		}
	});
});




describe("GrpcSymbol.Decompose test", () => {
	const simpleExamples = [
		{name: "FooBarBaz", expected: ["foo", "bar", "baz"]},
		{name: "æøåÆøåØåæøÅøæ", expected: ["æøå", "æøå", "øåæø", "åøæ"]},
		{name: "PascalCase", expected: ["pascal", "case"]},
		{name: "SCREAMING_SNAKE_CASE", expected: ["screaming", "snake", "case"]},
		{name: "snake_case", expected: ["snake", "case"]},
		{name: "Snakey_Pascal_Case", expected: ["snakey", "pascal", "case"]},
		{name: "InconsistentCasing_example", expected: ["inconsistent", "casing", "example"]},
		{name: "testingName_CasingTest", expected: ["testing", "name", "casing", "test"]},
	];

	const edgeExamples = [
		{name: "_foo_bar_baz", expected: ["_foo", "bar", "baz"]},
		{name: "__foo_bar_baz", expected: ["__foo", "bar", "baz"]},
		{name: "__foo__bar_baz", expected: ["__foo", "_bar", "baz"]},
		{name: "", expected: []},
		{name: "a", expected: ["a"]},
		{name: "A", expected: ["a"]},
		{name: "_", expected: ["_"]},
	];

	it("Should decompose simple correctly", () => {
		for (const example of simpleExamples) {
			assert.deepEqual((new GrpcSymbol(example.name, SymbolType.Special)).Decompose(), example.expected);
		}
	});

	it("Should decompose edge cases correctly", () => {
		for (const example of edgeExamples) {
			assert.deepEqual((new GrpcSymbol(example.name, SymbolType.Special)).Decompose(), example.expected);
		}
	});
});
