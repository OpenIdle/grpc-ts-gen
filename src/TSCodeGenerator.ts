import CodeGenerator from "./CodeGenerator";
import { GrpcSymbol, NamespacedSymbol } from "./GRPCDefinitionTranslator";
import { INamingTransformer } from "./INamingTransformer";


export class TSCodeGenerator {
	_namespaceRelativeLines: Map<string, {data: ({line: string} | {indent: true} | {unindent: true})[]}>;
	_currentNamespaceStack: Array<string>;
	_codeGenerator: CodeGenerator;
	_namingTransformer: INamingTransformer;
	constructor(codeGenerator: CodeGenerator, namingTransformer: INamingTransformer) {
		this._currentNamespaceStack = [];
		this._namespaceRelativeLines = new Map();
		this._namespaceRelativeLines.set("", {data: []});
		this._codeGenerator = codeGenerator;
		this._namingTransformer = namingTransformer;
	}

	private AddLineData(data: {line: string} | {indent: true} | {unindent: true}) {
		let namespaceIdentifier = this._currentNamespaceStack.join(".");
		this._namespaceRelativeLines
			.get(namespaceIdentifier)!.data
			.push(data);
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
		this.Indent();
		cb();
		this.Unindent();
		this.AddLine(`}`);
	}

	DefineEnum(name: GrpcSymbol, cb: () => void) {
		this.AddLine(`export enum ${this._namingTransformer.ConvertSymbol(name)} {`);
		this.Indent();
		cb();
		this.Unindent();
		this.AddLine(`}`);
	}

	Namespace(namespaces: GrpcSymbol[], cb: () => void) {
		this._currentNamespaceStack = namespaces.map((x) => this._namingTransformer.ConvertSymbol(x));
		let namespaceIdentifier = this._currentNamespaceStack.join(".");
		if (!this._namespaceRelativeLines.has(namespaceIdentifier)) {
			this._namespaceRelativeLines.set(namespaceIdentifier, {data: []});
		}
		cb();
		this._currentNamespaceStack = [];
	}

	Generate(): string {
		for (let [namespaceIdentifier, linesData] of this._namespaceRelativeLines) {
			if (linesData.data.length > 0) {
				let namespaces = namespaceIdentifier.split(".");
				for (let _namespace of namespaces) {
					this._codeGenerator.AddLine(`export namespace ${_namespace} {`);
					this._codeGenerator.Indent();
				}

				for (let lineData of linesData.data) {
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
					this._codeGenerator.AddLine(`}`);
				}
			}
		}
		return this._codeGenerator.Generate();
	}
}
