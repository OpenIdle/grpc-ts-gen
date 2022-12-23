import { ToCamelCase, ToPascalCase } from "./CasingGenerator";
import { GrpcSymbol, SymbolType } from "./GRPCDefinitionTranslator";
import { INamingTransformer } from "./INamingTransformer";

export class DefaultTransformer implements INamingTransformer {
	ConvertSymbol(symbol: GrpcSymbol): string {
		switch (symbol.type) {
			case SymbolType.Enum:
				return ToPascalCase(symbol.Decompose());
			case SymbolType.EnumValue:
				return ToPascalCase(symbol.Decompose());
			case SymbolType.Field:
				return ToCamelCase(symbol.Decompose());
			case SymbolType.Message:
				return ToPascalCase(symbol.Decompose());
			case SymbolType.Namespace:
				return ToPascalCase(symbol.Decompose());
			case SymbolType.Procedure:
				return ToPascalCase(symbol.Decompose());
			case SymbolType.Service:
				return "I" + ToPascalCase(symbol.Decompose());
			case SymbolType.Special:
				return symbol.name;
			default:
				throw new Error("Unknown symbol type");
		}
	}
}
