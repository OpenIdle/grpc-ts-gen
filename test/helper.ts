import { join } from "path";
import protobuf from "protobufjs";
import { ProtoDefinition } from "../src/GRPCDefinitionTranslator";

export async function loadFromPbjsDefinition(path: string): Promise<ProtoDefinition>;
export async function loadFromPbjsDefinition(path: string[]): Promise<ProtoDefinition>;

export async function loadFromPbjsDefinition(filenames: string | string[]): Promise<ProtoDefinition> {
    let root = new protobuf.Root();
	root.resolvePath = (origin, target) => {
		return join("test/data/", target);
	}
		
	let description = await protobuf.load(filenames, root);
	let data = ProtoDefinition.FromPbjs(description.toJSON());
	return data;	
}