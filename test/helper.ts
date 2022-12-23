import { join } from "path";
import protobuf from "protobufjs";
import { GrpcSymbol, ProtoDefinition } from "../src/GRPCDefinitionTranslator";
import { INamingTransformer } from "../src/INamingTransformer";

export async function loadFromPbjsDefinition(path: string): Promise<ProtoDefinition>;
export async function loadFromPbjsDefinition(path: string[]): Promise<ProtoDefinition>;

export async function loadFromPbjsDefinition(filenames: string | string[]): Promise<ProtoDefinition> {
	const root = new protobuf.Root();
	root.resolvePath = (origin, target) => {
		return join("test/data/", target);
	};
		
	const description = await protobuf.load(filenames, root);
	const data = ProtoDefinition.FromPbjs(description.toJSON());
	return data;
}

export class MockNamingTransformer implements INamingTransformer {
	private _modifier?: (symbol: GrpcSymbol) => string;
	
	constructor(modifier?: (symbol: GrpcSymbol) => string) {
		this._modifier = modifier;
	}

	ConvertSymbol(symbol: GrpcSymbol): string {
		if (this._modifier) {
			return this._modifier(symbol);
		}
		return symbol.name;
	}

}
