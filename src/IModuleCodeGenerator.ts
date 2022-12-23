import { GrpcSymbol, NamespacedSymbol } from "./GRPCDefinitionTranslator";
import { ICodeGenerator } from "./ICodeGenerator";


export interface IModuleCodeGenerator extends ICodeGenerator {
	IndentBlock(cb: () => void): void;
	DefineInterface(name: GrpcSymbol, cb: () => void): void;
	DefineEnum(name: GrpcSymbol, cb: () => void): void;
	Group(groupNames: GrpcSymbol[], cb: () => void): void;
	AddImport(symbol: NamespacedSymbol, importAs: string): void;
}
