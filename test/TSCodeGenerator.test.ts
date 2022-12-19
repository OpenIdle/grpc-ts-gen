import { assert } from "chai";
import { GrpcSymbol, SymbolType } from "../src/GRPCDefinitionTranslator";
import { INamingTransformer } from "../src/INamingTransformer";
import { GroupingMode, TSCodeGenerator } from "../src/TSCodeGenerator";
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
	describe("Namespace and module agnostic", () => {
		it("Should generate the file", () => {
			const namespaceGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Namespace);
			const moduleGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Module);
			[moduleGenerator, namespaceGenerator].forEach((codeGenerator) => {
				const vd = new VirtualDirectory();
				codeGenerator.Generate(vd);
				const entries = Array.from(vd.GetEntries());
				assert.equal(entries.length, 1, `There should be one entry (${codeGenerator.GetGroupingMode()})`);
				assert.deepEqual(entries[0], ["foo.ts", ""], `The entry should be called foo and be empty (${codeGenerator.GetGroupingMode()})`);
			});
		});
		it("Should add line correctly", () => {
			const namespaceGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Namespace);
			const moduleGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Module);
			[moduleGenerator, namespaceGenerator].forEach((codeGenerator) => {
				codeGenerator.AddLine("Some statement");
				codeGenerator.AddLine("Some other statement");
				const vd = new VirtualDirectory();
				codeGenerator.Generate(vd);
				const entries = Array.from(vd.GetEntries());
				assert.deepEqual(entries[0], ["foo.ts", "Some statement\nSome other statement"], `The entry should be called foo.ts with correct content (${codeGenerator.GetGroupingMode()})`);
			});
		});
		it("Should indent correctly", () => {
			const namespaceGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Namespace);
			const moduleGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Module);
			[moduleGenerator, namespaceGenerator].forEach((codeGenerator) => {
				codeGenerator.AddLine("Some statement");
				codeGenerator.Indent();
				codeGenerator.AddLine("Some other statement");
				codeGenerator.Unindent();
				codeGenerator.AddLine("Some third statement");
				
				const vd = new VirtualDirectory();
				codeGenerator.Generate(vd);
				const entries = Array.from(vd.GetEntries());
				assert.deepEqual(entries[0], ["foo.ts", "Some statement\n\tSome other statement\nSome third statement"], `The entry should be called foo.ts with correct content (${codeGenerator.GetGroupingMode()})`);
			});
		});
	
		it("Should indent using block correctly", () => {
			const namespaceGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Namespace);
			const moduleGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Module);
			[moduleGenerator, namespaceGenerator].forEach((codeGenerator) => {
				codeGenerator.AddLine("Some statement");
				codeGenerator.IndentBlock(() => {
					codeGenerator.AddLine("Some other statement");
				});
				codeGenerator.AddLine("Some third statement");

				const vd = new VirtualDirectory();
				codeGenerator.Generate(vd);
				const entries = Array.from(vd.GetEntries());
				assert.deepEqual(entries[0], ["foo.ts", "Some statement\n\tSome other statement\nSome third statement"], `The entry should be called foo.ts with correct content (${codeGenerator.GetGroupingMode()})`);
			});
		});
	
		it("Should define interface correctly", () => {
			const namespaceGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Namespace);
			const moduleGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Module);
			[moduleGenerator, namespaceGenerator].forEach((codeGenerator) => {
				codeGenerator.AddLine("Some statement");
				codeGenerator.DefineInterface(new GrpcSymbol("SomeInterface", SymbolType.Service), () => {
					codeGenerator.AddLine("somevalue: int");
				});
				codeGenerator.AddLine("Some third statement");
			
				const vd = new VirtualDirectory();
				codeGenerator.Generate(vd);
				const entries = Array.from(vd.GetEntries());
				assert.deepEqual(entries[0], ["foo.ts", "Some statement\nexport interface SomeInterface {\n\tsomevalue: int\n}\nSome third statement"], `The entry should be called foo.ts with correct content (${codeGenerator.GetGroupingMode()})`);
			});
		});
	
		it("Should define enum correctly", () => {
			const namespaceGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Namespace);
			const moduleGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Module);
			[moduleGenerator, namespaceGenerator].forEach((codeGenerator) => {
				codeGenerator.AddLine("Some statement");
				codeGenerator.DefineEnum(new GrpcSymbol("SomeEnum", SymbolType.Service), () => {
					codeGenerator.AddLine("aa = 2");
				});
				codeGenerator.AddLine("Some third statement");
			
				const vd = new VirtualDirectory();
				codeGenerator.Generate(vd);
				const entries = Array.from(vd.GetEntries());
				assert.deepEqual(entries[0], ["foo.ts", "Some statement\nexport enum SomeEnum {\n\taa = 2\n}\nSome third statement"], `The entry should be called foo.ts with correct content (${codeGenerator.GetGroupingMode()})`);
			});
		});
	});
	describe("Namespace generation", () => {
		it("Should group by namespaces", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Namespace);
	
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
	
		it("Should transform namespace names correctly", () => {
			const namingTranformer = new MockNamingTransformer((symbol) => {
				switch (symbol.type) {
					case SymbolType.Enum:
						return symbol.name + "Enum";
					case SymbolType.Message:
						return symbol.name + "Message";
					case SymbolType.Namespace:
						return symbol.name + "Namespace";
					default:
						assert.oneOf(symbol.type, [SymbolType.Enum, SymbolType.Message, SymbolType.Namespace]);
				}
				return symbol.name + "barbaz";
			});
			const codeGenerator = new TSCodeGenerator(namingTranformer, "foo.ts", GroupingMode.Namespace);
	
			codeGenerator.Group([new GrpcSymbol("foo", SymbolType.Namespace)], () => {
				codeGenerator.AddLine("");
			});
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			codeGenerator.DefineEnum(new GrpcSymbol("bar", SymbolType.Enum), () => {});
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			codeGenerator.DefineInterface(new GrpcSymbol("baz", SymbolType.Message), () => {});
	
			const vd = new VirtualDirectory();
			codeGenerator.Generate(vd);
			const entries = Array.from(vd.GetEntries());
			assert.equal(entries.length, 1, "There should be one entry");
			assert.deepEqual(entries[0], ["foo.ts", "export enum barEnum {\n}\nexport interface bazMessage {\n}\nexport namespace fooNamespace {\n\t\n}"], "The entry should be called foo.ts with correct content");
		});
	});
	describe("Module generation", () => {
		it("Should group by namespaces", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer(), "foo.ts", GroupingMode.Module);
	
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
			const flatEntries = vd.GetFlatEntries();
			console.log(flatEntries);
			assert.equal(new Set(flatEntries.keys()), new Set(["foo.ts", "foo/bar.ts", "baz/bar.ts", "foo/baz.ts"]))
			assert.equal(flatEntries.size, 4, "There should be four entry");
			//assert.deepEqual(flatEntries,g[0], ["foo.ts", "export namespace baz {\n\texport namespace bar {\n\t\tb\n\t}\n}\nexport namespace foo {\n\texport namespace bar {\n\t\ta\n\t}\n}\nexport namespace foo {\n\texport namespace baz {\n\t\tc\n\t}\n}"], "The entry should be called foo.ts with correct content");
		});
	
	});
});
