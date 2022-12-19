import { assert } from "chai";
import CodeGenerator from "../src/CodeGenerator";
import { GrpcSymbol, SymbolType } from "../src/GRPCDefinitionTranslator";
import { INamingTransformer } from "../src/INamingTransformer";
import { TSNamespaceCodeGenerator } from "../src/TSNamespaceCodeGenerator";
import { VirtualDirectory } from "../src/VirtualDirectory";

class MockNamingTransformer implements INamingTransformer {
	private _modifier?: (symbol: GrpcSymbol) => string;
	
	constructor(modifier?: (symbol: GrpcSymbol) => string) {
		this._modifier = modifier;
	}

	ConvertSymbol(symbol: GrpcSymbol): string {
		if (this._modifier) {
			return this._modifier(symbol);
		}
		return symbol.name;
	}

}

describe("TSCodeWriter test", () => {
	it("Should generate the file", () => {
		const codeGenerator = new TSNamespaceCodeGenerator(new CodeGenerator(), new MockNamingTransformer(), "foo.ts");
		const vd = new VirtualDirectory();
		codeGenerator.Generate(vd);
		const entries = Array.from(vd.GetEntries());
		assert.equal(entries.length, 1, "There should be one entry");
		assert.deepEqual(entries[0], ["foo.ts", ""], "The entry should be called foo and be empty");
	});
	it("Should add line correctly", () => {
		const codeGenerator = new TSNamespaceCodeGenerator(new CodeGenerator(), new MockNamingTransformer(), "foo.ts");
		codeGenerator.AddLine("Some statement");
		codeGenerator.AddLine("Some other statement");
		const vd = new VirtualDirectory();
		codeGenerator.Generate(vd);
		const entries = Array.from(vd.GetEntries());
		assert.equal(entries.length, 1, "There should be one entry");
		assert.deepEqual(entries[0], ["foo.ts", "Some statement\nSome other statement"], "The entry should be called foo.ts with correct content");
	});
	it("Should indent correctly", () => {
		const codeGenerator = new TSNamespaceCodeGenerator(new CodeGenerator(), new MockNamingTransformer(), "foo.ts");
		
		codeGenerator.AddLine("Some statement");
		codeGenerator.Indent();
		codeGenerator.AddLine("Some other statement");
		codeGenerator.Unindent();
		codeGenerator.AddLine("Some third statement");
		
		const vd = new VirtualDirectory();
		codeGenerator.Generate(vd);
		const entries = Array.from(vd.GetEntries());
		assert.equal(entries.length, 1, "There should be one entry");
		assert.deepEqual(entries[0], ["foo.ts", "Some statement\n\tSome other statement\nSome third statement"], "The entry should be called foo.ts with correct content");
	});

	it("Should indent using block correctly", () => {
		const codeGenerator = new TSNamespaceCodeGenerator(new CodeGenerator(), new MockNamingTransformer(), "foo.ts");
		
		codeGenerator.AddLine("Some statement");
		codeGenerator.IndentBlock(() => {
			codeGenerator.AddLine("Some other statement");
		});
		codeGenerator.AddLine("Some third statement");
		
		const vd = new VirtualDirectory();
		codeGenerator.Generate(vd);
		const entries = Array.from(vd.GetEntries());
		assert.equal(entries.length, 1, "There should be one entry");
		assert.deepEqual(entries[0], ["foo.ts", "Some statement\n\tSome other statement\nSome third statement"], "The entry should be called foo.ts with correct content");
	});

	it("Should define interface correctly", () => {
		const codeGenerator = new TSNamespaceCodeGenerator(new CodeGenerator(), new MockNamingTransformer(), "foo.ts");
		
		codeGenerator.AddLine("Some statement");
		codeGenerator.DefineInterface(new GrpcSymbol("SomeInterface", SymbolType.Service), () => {
			codeGenerator.AddLine("somevalue: int");
		});
		codeGenerator.AddLine("Some third statement");

		const vd = new VirtualDirectory();
		codeGenerator.Generate(vd);
		const entries = Array.from(vd.GetEntries());
		assert.equal(entries.length, 1, "There should be one entry");
		assert.deepEqual(entries[0], ["foo.ts", "Some statement\nexport interface SomeInterface {\n\tsomevalue: int\n}\nSome third statement"], "The entry should be called foo.ts with correct content");
	});

	it("Should define enum correctly", () => {
		const codeGenerator = new TSNamespaceCodeGenerator(new CodeGenerator(), new MockNamingTransformer(), "foo.ts");
		
		codeGenerator.AddLine("Some statement");
		codeGenerator.DefineEnum(new GrpcSymbol("SomeEnum", SymbolType.Service), () => {
			codeGenerator.AddLine("aa = 2");
		});
		codeGenerator.AddLine("Some third statement");

		const vd = new VirtualDirectory();
		codeGenerator.Generate(vd);
		const entries = Array.from(vd.GetEntries());
		assert.equal(entries.length, 1, "There should be one entry");
		assert.deepEqual(entries[0], ["foo.ts", "Some statement\nexport enum SomeEnum {\n\taa = 2\n}\nSome third statement"], "The entry should be called foo.ts with correct content");
	});

	it("Should group by namespaces", () => {
		const codeGenerator = new TSNamespaceCodeGenerator(new CodeGenerator(), new MockNamingTransformer(), "foo.ts");

		codeGenerator.Group([new GrpcSymbol("foo", SymbolType.Namespace), new GrpcSymbol("bar", SymbolType.Namespace)], () => {
			codeGenerator.AddLine("a");
		});

		codeGenerator.Group([new GrpcSymbol("baz", SymbolType.Namespace), new GrpcSymbol("bar", SymbolType.Namespace)], () => {
			codeGenerator.AddLine("b");
			
		});

		codeGenerator.Group([new GrpcSymbol("foo", SymbolType.Namespace), new GrpcSymbol("baz", SymbolType.Namespace)], () => {
			codeGenerator.AddLine("c");
		});

		const vd = new VirtualDirectory();
		codeGenerator.Generate(vd);
		const entries = Array.from(vd.GetEntries());
		assert.equal(entries.length, 1, "There should be one entry");
		assert.deepEqual(entries[0], ["foo.ts", "export namespace baz {\n\texport namespace bar {\n\t\tb\n\t}\n}\nexport namespace foo {\n\texport namespace bar {\n\t\ta\n\t}\n}\nexport namespace foo {\n\texport namespace baz {\n\t\tc\n\t}\n}"], "The entry should be called foo.ts with correct content");
	});
});
