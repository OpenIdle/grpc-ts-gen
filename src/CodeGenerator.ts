import { ICodeGenerator } from "./ICodeGenerator";
import { VirtualDirectory } from "./VirtualDirectory";

export default class CodeGenerator implements ICodeGenerator {
	
	_lines: {indentation: number, line: string}[];
	_currentIndentation: number;
	private _path: string[];
	constructor(path: string[]) {
		this._lines = [];
		this._currentIndentation = 0;
		this._path = path;
	}

	AddLine(line: string, indentation?: number): void {
		this._lines.push({indentation: indentation ?? this._currentIndentation, line: line});
	}

	Indent(): void {
		this._currentIndentation++;
	}

	Unindent(): void {
		this._currentIndentation--;
		if (this._currentIndentation < 0) {
			throw new Error("Unmatched unindent");
		}
	}

	Generate(vd: VirtualDirectory): void {
		vd.AddDeepEntry(this._path, 
			this._lines
				.map(line => "\t".repeat(line.indentation) + line.line)
				.join("\n")
		);
	}
}
