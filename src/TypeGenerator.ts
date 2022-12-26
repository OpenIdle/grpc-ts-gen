import { readdir, stat } from "fs/promises";
import { extname, join, relative } from "path";
import protobuf from "protobufjs";
import { ProtoDefinition } from "./GRPCDefinitionTranslator";
import { ICodeWriter } from "./ICodeWriter";
import { VirtualDirectory } from "./VirtualDirectory";

async function GatherAllProtoFiles(searchDirectory: string): Promise<string[]> {
	const directory = await readdir(searchDirectory);
	return (await Promise.all(directory.map(async (filename) => {
		const combinedPath = join(searchDirectory, filename);
		const entry = await stat(combinedPath);
		if (entry.isFile()) {
			if (extname(filename) == ".proto") {
				return [combinedPath];
			}
			return [];
		} else {
			return GatherAllProtoFiles(combinedPath);
		}
	}))).flat();
}

export class TypeGenerator {
	private _codeWriter: ICodeWriter;
	constructor(writer: ICodeWriter) {
		this._codeWriter = writer;
	}

	async Create(protoBasePath: string): Promise<VirtualDirectory> {
		const files = (await GatherAllProtoFiles(protoBasePath)).map(path => relative(protoBasePath, path));

		const root = new protobuf.Root();
		root.resolvePath = (origin, target) => {
			return join(protoBasePath, target);
		};
		
		const protobufJsJSON = await protobuf.load(files, root);
		
		const definition = ProtoDefinition.FromPbjs(protobufJsJSON);

		for (const message of definition.GetMessages()) {
			this._codeWriter.WriteMessageInterface(message);
		}

		for (const _enum of definition.GetEnums()) {
			this._codeWriter.WriteEnum(_enum);
		}

		for (const service of definition.GetServices()) {
			this._codeWriter.WriteServiceInterface(service, definition);
		}
		
		this._codeWriter.WriteServer(definition, protobufJsJSON);

		return this._codeWriter.GetResult();
	}
}
