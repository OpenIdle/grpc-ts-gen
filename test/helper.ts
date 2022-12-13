import protobuf from "protobufjs";

export function loadDefinition(path: string) {
    let description = await protobuf.load("test/data/messagesamples/MessageWithCustomTypes.proto");
	let data = ProtoDefinition.FromPbjs(description.toJSON());
	return data;	
}