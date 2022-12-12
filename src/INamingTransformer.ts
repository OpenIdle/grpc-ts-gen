import { GrpcSymbol } from "./GRPCDefinitionTranslator";

export interface INamingTransformer {
	ConvertSymbol(symbol: GrpcSymbol): string;
}
