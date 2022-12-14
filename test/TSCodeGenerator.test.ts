import { assert } from "chai";
import { GrpcSymbol, NamespacedSymbol, SymbolType } from "../src/GRPCDefinitionTranslator";
import { TSCodeGenerator } from "../src/TSCodeGenerator";
import { VirtualDirectory } from "../src/VirtualDirectory";
import { MockNamingTransformer } from "./helper";

describe("TSCodeWriter test", () => {
	describe("Code generation", () => {
		it("Should generate the file", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
			codeGenerator.AddLine("");
			const vd = new VirtualDirectory();
			codeGenerator.Generate(vd);
			const entries = Array.from(vd.GetEntries());
			assert.equal(entries.length, 1, "There should be one entry");
			assert.deepEqual(entries[0], ["index.ts", ""], "The entry should be called index.ts and be empty");
		});
		it("Should add line correctly", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
			codeGenerator.AddLine("Some statement");
			codeGenerator.AddLine("Some other statement");
			const vd = new VirtualDirectory();
			codeGenerator.Generate(vd);
			const entries = Array.from(vd.GetEntries());
			assert.deepEqual(entries[0], ["index.ts", "Some statement\nSome other statement"], "The entry should be called index.ts with correct content");
		});
		it("Should indent correctly", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
			codeGenerator.AddLine("Some statement");
			codeGenerator.Indent();
			codeGenerator.AddLine("Some other statement");
			codeGenerator.Unindent();
			codeGenerator.AddLine("Some third statement");
			
			const vd = new VirtualDirectory();
			codeGenerator.Generate(vd);
			const entries = Array.from(vd.GetEntries());
			assert.deepEqual(entries[0], ["index.ts", "Some statement\n\tSome other statement\nSome third statement"], "The entry should be called index.ts with correct content");
		});

		it("Should throw on unmatched unindents", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
			codeGenerator.AddLine("Some statement");
			codeGenerator.Indent();
			codeGenerator.AddLine("Some other statement");
			codeGenerator.Unindent();
			codeGenerator.Unindent();
			const vd = new VirtualDirectory();
			assert.throw(() =>  codeGenerator.Generate(vd));
		});

		it("Trying to import the symbol with two different aliases should throw", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
			codeGenerator.AddImport(NamespacedSymbol.FromString("foo.bar", SymbolType.Special), "baz");
			assert.throw(() => codeGenerator.AddImport(NamespacedSymbol.FromString("foo.bar", SymbolType.Special), "qux"));
		});

		it("Trying to import the symbol with and withou an alias should throw", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
			codeGenerator.AddImport(NamespacedSymbol.FromString("foo.bar", SymbolType.Special));
			assert.throw(() => codeGenerator.AddImport(NamespacedSymbol.FromString("foo.bar", SymbolType.Special), "baz"));
		});

		it("Imports from root should be handled correctly", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
			codeGenerator.Group([new GrpcSymbol("foo", SymbolType.Namespace)], () => {
				codeGenerator.AddImport(NamespacedSymbol.FromString("foo", SymbolType.Message));
				codeGenerator.AddLine("");
			});
			codeGenerator.AddImport(NamespacedSymbol.FromString("foo.bar", SymbolType.Message));
			codeGenerator.AddLine("");
			
			const vd = new VirtualDirectory();
			codeGenerator.Generate(vd);
			const flatEntries = vd.GetFlatEntries();

			assert.equal(flatEntries.get("index.ts"), "import {bar} from \"./foo\";\n");
			assert.equal(flatEntries.get("foo.ts"), "import {foo} from \"./\";\n");

			assert.deepEqual(new Set(flatEntries.keys()), new Set(["index.ts", "foo.ts"]));
		});
	
		it("Should indent using block correctly", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
			codeGenerator.AddLine("Some statement");
			codeGenerator.IndentBlock(() => {
				codeGenerator.AddLine("Some other statement");
			});
			codeGenerator.AddLine("Some third statement");

			const vd = new VirtualDirectory();
			codeGenerator.Generate(vd);
			const entries = Array.from(vd.GetEntries());
			assert.deepEqual(entries[0], ["index.ts", "Some statement\n\tSome other statement\nSome third statement"], "The entry should be called index.ts with correct content");
		});
	
		it("Should define interface correctly", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
			codeGenerator.AddLine("Some statement");
			codeGenerator.DefineInterface(new GrpcSymbol("SomeInterface", SymbolType.Service), () => {
				codeGenerator.AddLine("somevalue: int");
			});
			codeGenerator.AddLine("Some third statement");
		
			const vd = new VirtualDirectory();
			codeGenerator.Generate(vd);
			const entries = Array.from(vd.GetEntries());
			assert.deepEqual(entries[0], ["index.ts", "Some statement\nexport interface SomeInterface {\n\tsomevalue: int\n}\nSome third statement"], "The entry should be called index.ts with correct content");
		});
	
		it("Should define enum correctly", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
			codeGenerator.AddLine("Some statement");
			codeGenerator.DefineEnum(new GrpcSymbol("SomeEnum", SymbolType.Service), () => {
				codeGenerator.AddLine("aa = 2");
			});
			codeGenerator.AddLine("Some third statement");
		
			const vd = new VirtualDirectory();
			codeGenerator.Generate(vd);
			const entries = Array.from(vd.GetEntries());
			assert.deepEqual(entries[0], ["index.ts", "Some statement\nexport enum SomeEnum {\n\taa = 2\n}\nSome third statement"], "The entry should be called index.ts with correct content");
		});
	});
	describe("Module generation", () => {
		it("Should group by namespaces", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
	
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
			
			assert.deepEqual(flatEntries.get("foo/bar.ts"), "a");
			assert.deepEqual(flatEntries.get("baz/bar.ts"), "b");
			assert.deepEqual(flatEntries.get("foo/baz.ts"), "c");
			assert.deepEqual(new Set(flatEntries.keys()), new Set(["foo/bar.ts", "baz/bar.ts", "foo/baz.ts"]));
		});
		it("Nested groups should work", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
	
			codeGenerator.Group([new GrpcSymbol("baz", SymbolType.Namespace)], () => {
				codeGenerator.Group([new GrpcSymbol("bar", SymbolType.Namespace)], () => {
					codeGenerator.AddLine("a");
				});
				codeGenerator.AddLine("b");
			});
		
			const vd = new VirtualDirectory();
			codeGenerator.Generate(vd);

			const flatEntries = vd.GetFlatEntries();
			assert.deepEqual(flatEntries.get("baz.ts"), "b", "Should contain baz.ts module containing 'b'");
			assert.deepEqual(flatEntries.get("baz/bar.ts"), "a", "Should contain baz/bar.ts module containing 'a'");

			assert.deepEqual(new Set(flatEntries.keys()), new Set(["baz.ts", "baz/bar.ts"]), "Should not have unexpected files");
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
					case SymbolType.Special:
						return symbol.name;
					default:
						assert.oneOf(symbol.type, [SymbolType.Enum, SymbolType.Message, SymbolType.Namespace, SymbolType.Special]);
				}
				return symbol.name + "barbaz";
			});
			const codeGenerator = new TSCodeGenerator(namingTranformer);
	
			codeGenerator.Group([new GrpcSymbol("qux", SymbolType.Namespace), new GrpcSymbol("baz", SymbolType.Namespace)], () => {
				codeGenerator.AddLine("");
			});
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			codeGenerator.DefineEnum(new GrpcSymbol("bar", SymbolType.Enum), () => {});
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			codeGenerator.DefineInterface(new GrpcSymbol("baz", SymbolType.Message), () => {});
			codeGenerator.AddImport(NamespacedSymbol.FromString("foo.bar.baz", SymbolType.Enum), "IMPORT_foo_bar_baz");
			codeGenerator.AddImport(NamespacedSymbol.FromString("foo.bar.qux", SymbolType.Message), "IMPORT_foo_bar_qux");
			codeGenerator.AddImport(NamespacedSymbol.FromString("foo.bar", SymbolType.Message));
	
			const vd = new VirtualDirectory();
			codeGenerator.Generate(vd);
			const flatEntries = vd.GetFlatEntries();

			assert.equal(flatEntries.get("quxNamespace/bazNamespace.ts"), "");
			assert.equal(flatEntries.get("index.ts"), 
				"import {barMessage} from \"./fooNamespace\";\n" +
				"import {bazEnum as IMPORT_foo_bar_baz, quxMessage as IMPORT_foo_bar_qux} from \"./fooNamespace/barNamespace\";\n" +
				"export enum barEnum {\n" +
				"}\n" + 
				"export interface bazMessage {\n" + 
				"}",
				"index.ts should have correct contents"
			);
			
			assert.deepEqual(new Set(flatEntries.keys()), new Set(["index.ts", "quxNamespace/bazNamespace.ts"]), "The correct file structure should be created");
		});
		it("Should import correctly", () => {
			const codeGenerator = new TSCodeGenerator(new MockNamingTransformer());
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			codeGenerator.DefineInterface(new GrpcSymbol("qux", SymbolType.Message), () => {});
			codeGenerator.AddImport(NamespacedSymbol.FromString("foo.bar.baz", SymbolType.Message), "IMPORT_foo_bar_baz");
			codeGenerator.Group([new GrpcSymbol("foo", SymbolType.Namespace), new GrpcSymbol("bar", SymbolType.Namespace)], () => {
				codeGenerator.AddImport(NamespacedSymbol.FromString("qux", SymbolType.Message), "IMPORT_qux");
				codeGenerator.AddImport(NamespacedSymbol.FromString("quux", SymbolType.Message));
				codeGenerator.AddImport(NamespacedSymbol.FromString("foo.bar", SymbolType.Message), "IMPORT_foo_bar");
				codeGenerator.AddImport(NamespacedSymbol.FromString("foo.baz", SymbolType.Message), "IMPORT_foo_baz");
				codeGenerator.AddImport(NamespacedSymbol.FromString("foo.baz", SymbolType.Message), "IMPORT_foo_baz");
				codeGenerator.AddImport(NamespacedSymbol.FromString("foo.baz", SymbolType.Message), "IMPORT_foo_baz");
				codeGenerator.AddLine("");
			});
			codeGenerator.Group([new GrpcSymbol("foo", SymbolType.Namespace)], () => {
				codeGenerator.AddLine("");
			});
			const vd = new VirtualDirectory();
			codeGenerator.Generate(vd);
			const flatEntries = vd.GetFlatEntries();
			
			assert.equal(
				flatEntries.get("index.ts"),
				"import {baz as IMPORT_foo_bar_baz} from \"./foo/bar\";\n" +
				"export interface qux {\n" +
				"}",
				"Expected index.ts to have correct imports"
			);

			assert.equal(
				flatEntries.get("foo/bar.ts"),
				"import {quux, qux as IMPORT_qux} from \"./..\";\n" +
				"import {bar as IMPORT_foo_bar, baz as IMPORT_foo_baz} from \"./../foo\";\n",
				"Expected foo/bar.ts to have correct imports"
			);

			assert.equal(
				flatEntries.get("foo.ts"),
				"",
				"Expected foo.ts to have correct imports"
			);
			
			assert.deepEqual(new Set(flatEntries.keys()), new Set(["index.ts", "foo/bar.ts", "foo.ts"]), "The correct file structure should be created");
		});
	});
});
