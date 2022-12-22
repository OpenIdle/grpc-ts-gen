import { GrpcSymbol, NamespacedSymbol } from "./GRPCDefinitionTranslator";
import { VirtualDirectory } from "./VirtualDirectory";


export interface IModuleCodeGenerator {
	AddLine(line: string): void;
	Indent(): void;
	Unindent(): void;
	IndentBlock(cb: () => void): void;
	DefineInterface(name: GrpcSymbol, cb: () => void): void;
	DefineEnum(name: GrpcSymbol, cb: () => void): void;
	Group(groupNames: GrpcSymbol[], cb: () => void): void;
	Generate(vd: VirtualDirectory): void;
	AddImport(symbol: NamespacedSymbol, importAs: string): void;
}
