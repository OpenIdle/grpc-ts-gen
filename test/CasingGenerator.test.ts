import { assert } from "chai";
import { ToCamelCase, ToPascalCase, ToScreamingSnakeCase, ToSnakeCase } from "../src/CasingGenerator";

describe("Casing generator test", () => {
	it("Should convert to camel case", () => {
		assert.equal(ToPascalCase(["foo", "bar", "baz"]), "FooBarBaz");
	});
	it("Should convert to camel case", () => {
		assert.equal(ToCamelCase(["foo", "bar", "baz"]), "fooBarBaz");
	});
	it("Should convert to snake case", () => {
		assert.equal(ToSnakeCase(["foo", "bar", "baz"]), "foo_bar_baz");
	});
	it("Should convert to screaming snake case", () => {
		assert.equal(ToScreamingSnakeCase(["foo", "bar", "baz"]), "FOO_BAR_BAZ");
	});
});
