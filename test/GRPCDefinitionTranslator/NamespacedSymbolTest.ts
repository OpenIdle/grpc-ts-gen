import { assert } from "chai"
import { NamespacedSymbol } from "../../src/GRPCDefinitionTranslator"

describe("NamespacedSymbol.FromString test", () => {
	it("Should convert only class name correctly", () => {
		let _symbol = NamespacedSymbol.FromString("foo");
		assert.equal(_symbol.namespace.length, 0, "No namespaces should be found");
		assert.equal(_symbol.name.name, "foo", "Class name should be foo");
	});
	it("Should convert 2 namespaces and 1 class name correctly", () => {
		let _symbol = NamespacedSymbol.FromString("foo.bar.baz");
		assert.equal(_symbol.namespace.length, 2, "2 namespaces should be found");
		assert.equal(_symbol.namespace[0].name, "foo", "First namespace should be 'foo'")
		assert.equal(_symbol.namespace[1].name, "bar", "Second namespace should be 'bar'")
		assert.equal(_symbol.name.name, "baz", "the class name should be 'baz'");
	});
})