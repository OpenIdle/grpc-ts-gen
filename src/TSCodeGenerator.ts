import path from "path";
import CodeGenerator from "./CodeGenerator";
import { GrpcSymbol, NamespacedSymbol, SymbolType } from "./GRPCDefinitionTranslator";
import { IModuleCodeGenerator } from "./IModuleCodeGenerator";
import { INamingTransformer } from "./INamingTransformer";
import { VirtualDirectory } from "./VirtualDirectory";

export enum GroupingMode {
	Namespace,
	Module,
}

interface Importation {
	modulePath: GrpcSymbol[];
	imports:  {
		symbol: GrpcSymbol;
		importAs: string;
	}[]
}

type CodeGeneratorInstructions = {line: string} | {indent: true} | {unindent: true};

class ModuleDescription {
	instructions: CodeGeneratorInstructions[];
	private importations: Map<string, Importation>;
	symbolPath: GrpcSymbol[];

	constructor(symbolPath: GrpcSymbol[]) {
		this.instructions = [];
		this.importations = new Map();
		this.symbolPath = symbolPath;
	}

	AddImport(symbol: NamespacedSymbol, importAs: string) {
		let moduleIdentifier = symbol.namespace.map(name => name.name).join(".");
		let importation = this.importations.get(moduleIdentifier);
		if (importation == null) {
			importation = {
				modulePath: symbol.namespace,
				imports: []
			};
			this.importations.set(moduleIdentifier, importation);
		}
		importation.imports.push({symbol: symbol.name, importAs});
	}

	GetImportations(): Iterable<Importation> {
		return this.importations.values();
	}
}

export class TSCodeGenerator implements IModuleCodeGenerator {
	private _modules: Map<string, ModuleDescription>;
	private _currentNamespaceStack: Array<GrpcSymbol>;
	private _namingTransformer: INamingTransformer;
	constructor(namingTransformer: INamingTransformer) {
		this._currentNamespaceStack = [];
		this._modules = new Map();
		this._modules.set("", new ModuleDescription([new GrpcSymbol("index", SymbolType.Special)]));
		this._namingTransformer = namingTransformer;
	}

	IndentBlock(cb: () => void): void {
		this.Indent();
		cb();
		this.Unindent();
	}

	Group(groupNames: GrpcSymbol[], cb: () => void): void {
		let oldNamespaceStack = this._currentNamespaceStack.slice()
		this._currentNamespaceStack = this._currentNamespaceStack.concat(groupNames);
		const namespaceIdentifier = this._currentNamespaceStack.map(x => x.name).join(".");
		if (!this._modules.has(namespaceIdentifier)) {
			this._modules.set(namespaceIdentifier, new ModuleDescription(this._currentNamespaceStack.slice()));
		}
		cb();
		this._currentNamespaceStack = oldNamespaceStack;
	}

	private GetCurrentModule(): ModuleDescription {
		const namespaceIdentifier = this._currentNamespaceStack.map(x => x.name).join(".");
		const currentModule = this._modules.get(namespaceIdentifier);
		
		if (currentModule == null) {
			throw new Error("Tried to add line data from non existant namespace");
		}
		return currentModule
	}

	private AddLineData(data: CodeGeneratorInstructions) {
		let module = this.GetCurrentModule();

		module.instructions.push(data);
	}

	AddLine(line: string) {
		this.AddLineData({line});
	}

	Indent() {
		this.AddLineData({indent: true});
	}

	Unindent() {
		this.AddLineData({unindent: true});
	}

	DefineInterface(name: GrpcSymbol, cb: () => void) {
		this.AddLine(`export interface ${this._namingTransformer.ConvertSymbol(name)} {`);
		this.IndentBlock(cb);
		this.AddLine("}");
	}

	DefineEnum(name: GrpcSymbol, cb: () => void) {
		this.AddLine(`export enum ${this._namingTransformer.ConvertSymbol(name)} {`);
		this.IndentBlock(cb);
		this.AddLine("}");
	}

	Generate(vd: VirtualDirectory): void {
		this.GenerateModuleGrouping(vd);
	}

	AddImport(symbol: NamespacedSymbol, importAs: string): void {
		let module = this.GetCurrentModule();
		module.AddImport(symbol, importAs);
	}

	private GenerateModuleGrouping(vd: VirtualDirectory): void {
		const indexGenerator = new CodeGenerator();
		for (const module of this._modules.values()) {
			if (module.instructions.length > 0) {
				let generator: CodeGenerator = new CodeGenerator();
				this.GenerateImports(generator, Array.from(module.GetImportations()), module);
				
				this.GenerateCodeFromLineData(generator, module.instructions);

				if (generator != indexGenerator) {
					const groupingPath = module.symbolPath
						.map(x => this._namingTransformer.ConvertSymbol(x));
					groupingPath[groupingPath.length - 1] += ".ts";
					vd.AddDeepEntry(groupingPath, generator.Generate());
				}
			}
		}
	}

	private GenerateImports(generator: CodeGenerator, imports: Importation[], module: ModuleDescription): void {
		let transformedImporations = 
			imports.map(importation => ({
				modulePath: this.ResolveModulePath(module, importation.modulePath),
				imported: importation.imports
					.map(_import => ({
						fromName: this._namingTransformer.ConvertSymbol(_import.symbol),
						importAs: _import.importAs
					}))
					.sort((a, b) => a.fromName.localeCompare(b.fromName))
			}))
			.sort((a, b) => a.modulePath.localeCompare(b.modulePath));
		for (const transformedImportation of transformedImporations) {
			generator.AddLine(`import {${transformedImportation.imported.map(x => `${x.fromName} as ${x.importAs}`).join(", ")}} from ${JSON.stringify(transformedImportation.modulePath)};`);
		}
	}

	private ResolveModulePath(currentModule: ModuleDescription, targetModulePath: GrpcSymbol[]): string {
		let currentPath = path.dirname(currentModule.symbolPath.map((symbol) => this._namingTransformer.ConvertSymbol(symbol)).join("/"));
		let targetPath = targetModulePath.map((symbol) => this._namingTransformer.ConvertSymbol(symbol)).join("/");
		if (currentPath == "index") {
			currentPath = "";
		}
		if (currentPath == targetPath) {
			return "./../" + targetPath;
		}

		let resolved = path.relative(currentPath, targetPath);

		return "./" + resolved;
	}

	private GenerateCodeFromLineData(generator: CodeGenerator, linesData: CodeGeneratorInstructions[]): void {
		for (const lineData of linesData) {
			if ("indent" in lineData) {
				generator.Indent();
			} else if ("unindent" in lineData) {
				generator.Unindent();
			} else {
				generator.AddLine(lineData.line);
			}
		}
	}
}
