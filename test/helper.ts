import { join } from "path";
import protobuf from "protobufjs";
import { ProtoDefinition } from "../src/GRPCDefinitionTranslator";

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
