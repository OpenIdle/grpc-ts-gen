import CodeGenerator from "./CodeGenerator";
import { GrpcSymbol } from "./GRPCDefinitionTranslator";
import { IGroupingCodeGenerator } from "./IGroupingCodeGenerator";
import { INamingTransformer } from "./INamingTransformer";
import { VirtualDirectory } from "./VirtualDirectory";


export class TSNamespaceCodeGenerator implements IGroupingCodeGenerator {
	private _namespaceRelativeLines: Map<string, {data: ({line: string} | {indent: true} | {unindent: true})[]}>;
	private _currentNamespaceStack: Array<string>;
	private _codeGenerator: CodeGenerator;
	private _namingTransformer: INamingTransformer;
	private _filename: string;
	constructor(codeGenerator: CodeGenerator, namingTransformer: INamingTransformer, filename: string) {
		this._currentNamespaceStack = [];
		this._namespaceRelativeLines = new Map();
		this._namespaceRelativeLines.set("", {data: []});
		this._codeGenerator = codeGenerator;
		this._namingTransformer = namingTransformer;
		this._filename = filename;
	}

	IndentBlock(cb: () => void): void {
		this.Indent();
		cb();
		this.Unindent();
	}

	Group(groupNames: GrpcSymbol[], cb: () => void): void {
		this._currentNamespaceStack = groupNames.map((x) => this._namingTransformer.ConvertSymbol(x));
		const namespaceIdentifier = this._currentNamespaceStack.join(".");
		if (!this._namespaceRelativeLines.has(namespaceIdentifier)) {
			this._namespaceRelativeLines.set(namespaceIdentifier, {data: []});
		}
		cb();
		this._currentNamespaceStack = [];
	}

	private AddLineData(data: {line: string} | {indent: true} | {unindent: true}) {
		const namespaceIdentifier = this._currentNamespaceStack.join(".");
		const relativeLines = this._namespaceRelativeLines.get(namespaceIdentifier);
		
		if (relativeLines == null) {
			throw new Error("Tried to add line data from non existant namespace");
		}

		relativeLines.data.push(data);
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
		const entries = Array.from(this._namespaceRelativeLines.entries());
		entries.sort((a,b) => a[0].localeCompare(b[0]));
		for (const [namespaceIdentifier, linesData] of entries) {
			if (linesData.data.length > 0) {
				let namespaces: string[];
				if (namespaceIdentifier == "") {
					namespaces = [];
				} else {
					namespaces = namespaceIdentifier.split(".");
				}

				for (const _namespace of namespaces) {
					this._codeGenerator.AddLine(`export namespace ${_namespace} {`);
					this._codeGenerator.Indent();
				}

				for (const lineData of linesData.data) {
					if ("indent" in lineData) {
						this._codeGenerator.Indent();
					} else if ("unindent" in lineData) {
						this._codeGenerator.Unindent();
					} else {
						this._codeGenerator.AddLine(lineData.line);
					}
				}

				for (let i = 0; i < namespaces.length; i++) {
					this._codeGenerator.Unindent();
					this._codeGenerator.AddLine("}");
				}
			}
		}
		vd.AddEntry(this._filename, this._codeGenerator.Generate());
	}
}
