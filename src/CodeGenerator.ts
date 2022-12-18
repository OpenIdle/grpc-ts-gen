
export default class CodeGenerator {
	
	_lines: {indentation: number, line: string}[];
	_currentIndentation: number;

	constructor() {
		this._lines = [];
		this._currentIndentation = 0;
	}

	AddLine(line: string, indentation?: number) {
		this._lines.push({indentation: indentation ?? this._currentIndentation, line: line});
	}

	Indent() {
		this._currentIndentation++;
	}

	Unindent() {
		this._currentIndentation--;
		if (this._currentIndentation < 0) {
			throw new Error("Unmatched unindent");
		}
	}

	Generate(): string {
		return this._lines.map(line => "\t".repeat(line.indentation) + line.line).join("\n");
	}
}
