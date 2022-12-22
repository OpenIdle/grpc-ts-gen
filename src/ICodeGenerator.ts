import { VirtualDirectory } from "./VirtualDirectory";

export interface ICodeGenerator {
	AddLine(line: string, indentation?: number): void;
	Indent(): void;
	Unindent(): void;
	Generate(vd: VirtualDirectory): void;
}
