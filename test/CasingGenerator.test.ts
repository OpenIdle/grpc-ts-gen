import { assert } from "chai";
import { ToCamelCase, ToPascalCase, ToScreamingSnakeCase, ToSnakeCase } from "../src/CasingGenerator";

describe("Casing generator test", () => {
	it("Should convert to camel case", () => {
		assert.equal(ToPascalCase(["foo", "bar", "baz"]), "FooBarBaz");
		assert.equal(ToPascalCase([]), "");
		assert.equal(ToPascalCase([""]), "");
		assert.equal(ToPascalCase(["bar"]), "Bar");
		assert.equal(ToPascalCase(["bar", ""]), "Bar");
		assert.equal(ToPascalCase(["", "bar"]), "Bar");
	});
	it("Should convert to camel case", () => {
		assert.equal(ToCamelCase(["foo", "bar", "baz"]), "fooBarBaz");
		assert.equal(ToCamelCase([]), "");
		assert.equal(ToCamelCase([""]), "");
		assert.equal(ToCamelCase(["bar"]), "bar");
		assert.equal(ToCamelCase(["bar", ""]), "bar");
		assert.equal(ToCamelCase(["", "bar"]), "Bar");
	});
	it("Should convert to snake case", () => {
		assert.equal(ToSnakeCase(["foo", "bar", "baz"]), "foo_bar_baz");
		assert.equal(ToSnakeCase([]), "");
		assert.equal(ToSnakeCase([""]), "");
		assert.equal(ToSnakeCase(["bar"]), "bar");
		assert.equal(ToSnakeCase(["bar", ""]), "bar_");
		assert.equal(ToSnakeCase(["", "bar"]), "_bar");
	});
	it("Should convert to screaming snake case", () => {
		assert.equal(ToScreamingSnakeCase(["foo", "bar", "baz"]), "FOO_BAR_BAZ");
		assert.equal(ToScreamingSnakeCase([]), "");
		assert.equal(ToScreamingSnakeCase([""]), "");
		assert.equal(ToScreamingSnakeCase(["bar"]), "BAR");
		assert.equal(ToScreamingSnakeCase(["bar", ""]), "BAR_");
		assert.equal(ToScreamingSnakeCase(["", "bar"]), "_BAR");
	});
});
