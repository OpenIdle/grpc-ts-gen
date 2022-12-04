import CodeGenerator from "./CodeGenerator";
import { NamespacedSymbol } from "./GRPCDefintionTranslator";


export class NamespaceAwareCodeGenerator {
	_namespaceRelativeLines: Map<string, {data: ({line: string} | {indent: true} | {unindent: true})[]}>;
	_currentNamespaceStack: Array<string>;
	_codeGenerator: CodeGenerator;
	constructor(codeGenerator: CodeGenerator) {
		this._currentNamespaceStack = [];
		this._namespaceRelativeLines = new Map();
		this._namespaceRelativeLines.set("", {data: []});
		this._codeGenerator = codeGenerator;
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

	DefineInterface(symbol: NamespacedSymbol, cb: () => void) {
		this.Namespace(symbol.namespace.map(x => x.name), () => {
			this.AddLine(`export interface ${symbol.name.name} {`);
			this.Indent();
			cb();
			this.Unindent();
			this.AddLine(`}`);
		});
	}

	DefineEnum(symbol: NamespacedSymbol, cb: () => void) {
		this.Namespace(symbol.namespace.map(x => x.name), () => {
			this.AddLine(`export enum ${symbol.name.name} {`);
			this.Indent();
			cb();
			this.Unindent();
			this.AddLine(`}`);
		});
	}

	Namespace(namespaces: string[], cb: () => void) {
		this._currentNamespaceStack = namespaces;
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
