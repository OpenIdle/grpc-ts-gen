import CodeGenerator from "./CodeGenerator";
import { GrpcSymbol } from "./GRPCDefinitionTranslator";
import { IGroupingCodeGenerator } from "./IGroupingCodeGenerator";
import { INamingTransformer } from "./INamingTransformer";
import { VirtualDirectory } from "./VirtualDirectory";

export enum GroupingMode {
	Namespace,
	Module,
}

export class TSCodeGenerator implements IGroupingCodeGenerator {
	private _namespaceRelativeLines: Map<string, {data: ({line: string} | {indent: true} | {unindent: true})[]}>;
	private _currentNamespaceStack: Array<string>;
	private _namingTransformer: INamingTransformer;
	private _defaultFileName: string;
	private _groupingMode: GroupingMode;
	constructor(namingTransformer: INamingTransformer, defaultFileName: string, groupingMode: GroupingMode) {
		this._currentNamespaceStack = [];
		this._namespaceRelativeLines = new Map();
		this._namespaceRelativeLines.set("", {data: []});
		this._namingTransformer = namingTransformer;
		this._defaultFileName = defaultFileName;
		this._groupingMode = groupingMode;
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
		if (this._groupingMode == GroupingMode.Namespace) {
			this.GenerateNamespaceGrouping(vd);
		} else {
			this.GenerateModuleGrouping(vd);
		}
	}

	private GenerateNamespaceGrouping(vd: VirtualDirectory): void {
		const codeGenerator = new CodeGenerator();
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
					codeGenerator.AddLine(`export namespace ${_namespace} {`);
					codeGenerator.Indent();
				}

				this.GenerateCodeFromLineData(codeGenerator, linesData.data)

				for (let i = 0; i < namespaces.length; i++) {
					codeGenerator.Unindent();
					codeGenerator.AddLine("}");
				}
			}
		}
		vd.AddEntry(this._defaultFileName, codeGenerator.Generate());
	}

	private GenerateModuleGrouping(vd: VirtualDirectory): void {
		const indexGenerator = new CodeGenerator();
		for (const [namespaceIdentifier, linesData] of this._namespaceRelativeLines) {
			if (linesData.data.length > 0) {
				let groupingPath: string[];
				if (namespaceIdentifier == "") {
					groupingPath = [];
				} else {
					groupingPath = namespaceIdentifier.split(".");
					groupingPath[groupingPath.length - 1] += ".ts";
				}
				let targetGenerator: CodeGenerator;
				if (groupingPath.length == 0) {
					targetGenerator = indexGenerator;
				} else {
					targetGenerator = new CodeGenerator();
				}

				this.GenerateCodeFromLineData(targetGenerator, linesData.data);

				if (targetGenerator != indexGenerator) {
					vd.AddDeepEntry(groupingPath, targetGenerator.Generate());
				}
			}
		}
		vd.AddEntry(this._defaultFileName, indexGenerator.Generate());
	}

	private GenerateCodeFromLineData(generator: CodeGenerator, linesData: Array<{
		line: string;
	} | {
		indent: true;
	} | {
		unindent: true;
	}>) {
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

	public GetGroupingMode(): GroupingMode {
		return this._groupingMode;
	}
}
