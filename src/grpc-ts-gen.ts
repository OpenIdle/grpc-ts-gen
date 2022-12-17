#!/usr/bin/env node

import {readdir, readFile, stat } from "fs/promises";
import { extname, join, relative, resolve } from "path";
import * as  protoLoader from "@grpc/proto-loader";
import CodeGenerator from "./CodeGenerator";
import { ProtoDefinition } from "./GRPCDefinitionTranslator";
import { ICodeWriter } from "./ICodeWriter";
import { VirtualDirectory, WriteVirtualDirectory } from "./VirtualDirectory";
import { TSWriter } from "./TSCodeWriter";
import { INamingTransformer } from "./INamingTransformer";
import protobuf from "protobufjs";
import { DefaultTransformer } from "./DefaultTransformer";

async function GatherAllProtoFiles(searchDirectory: string): Promise<string[]> {
	let directory = await readdir(searchDirectory);
	return (await Promise.all(directory.map(async (filename) => {
		let combinedPath = join(searchDirectory, filename);
		let entry = await stat(combinedPath);
		if (entry.isFile()) {
			if (extname(filename) == ".proto") {
				return [combinedPath];
			}
			return [];
		} else {
			return GatherAllProtoFiles(combinedPath);
		}
	}))).flat()
}

class TypeDefinitionCreator {
	private _codeWriter: ICodeWriter;
	constructor(writer: ICodeWriter) {
		this._codeWriter = writer;
	}

	async Create(protoBasePath: string): Promise<VirtualDirectory> {
		let files = (await GatherAllProtoFiles(protoBasePath)).map(path => relative(protoBasePath, path));
		let protos = await protoLoader.load(files, {
			includeDirs: [protoBasePath]
		});

		let root = new protobuf.Root();
		root.resolvePath = (origin, target) => {
			return join(protoBasePath, target);
		}
		
		let protobufJsJSON = await protobuf.load(files, root);
		
		let definition = ProtoDefinition.FromPbjs(protobufJsJSON);

		for (let message of definition.GetMessages()) {
			this._codeWriter.WriteMessageInterface(message);
		}

		for (let _enum of definition.GetEnums()) {
			this._codeWriter.WriteEnum(_enum);
		}

		for (let service of definition.GetServices()) {
			this._codeWriter.WriteServiceInterface(service);
		}
		
		this._codeWriter.WriteServer(Array.from(definition.GetServices()), protos, protobufJsJSON.toJSON());

		return this._codeWriter.GetResult();
	}
}

interface ProgramOptions {
	protoBasePath: string;
	outPath: string;
	requestBodyAsParameters: boolean;
	serverName: string;
}

async function main(args: string[]): Promise<number> {
	let customOptions: Partial<ProgramOptions> = {};

	try {
		let configFile = await readFile("grpc-ts-gen.config.json");
		let fileConfig = JSON.parse(configFile.toString());
		if (typeof(fileConfig) != "object") {
			throw new Error("grpc-ts-gen.config.json is invalid");
		}
		if ("protoBasePath" in fileConfig) {
			if (typeof(fileConfig.protoBasePath) != "string") {
				throw new Error("protoBasePath has to be a string");
			}
			customOptions.protoBasePath = fileConfig.protoBasePath;
		}
		if ("outPath" in fileConfig) {
			if (typeof(fileConfig.outPath) != "string") {
				throw new Error("outPath has to be a string");
			}
			customOptions.outPath = fileConfig.outPath;
		}
		if ("serverName" in fileConfig) {
			if (typeof(fileConfig.serverName) != "string") {
				throw new Error("serverName has to be a string");
			}
			customOptions.serverName = fileConfig.serverName;
		}
		if ("requestBodyAsObject" in fileConfig) {
			if (typeof(fileConfig.requestBodyAsObject) != "boolean") {
				throw new Error("requestBodyAsObject has to be a boolean");
			}
			customOptions.requestBodyAsParameters = !fileConfig.requestBodyAsObject;
		}
	} catch (e) {
		if (e == null || typeof(e) != "object" || (e as any).code != "ENOENT") {
			throw e;
		}
	}

	for (let i = 2; i < args.length; i++) {
		if (i + 1 < args.length) {
			if (args[i].toLowerCase() == "--protobasepath") {
				customOptions.protoBasePath = args[i + 1];
				i++;
				continue;
			} else if (args[i].toLowerCase() == "--outpath") {
				customOptions.outPath = args[i + 1];
				i++
				continue;
			} else if (args[i].toLowerCase() == "--servername") {
				customOptions.serverName = args[i + 1];
				i++;
				continue;
			}
		}

		if (args[i].toLowerCase() == "--requestbodyasobject") {
			customOptions.requestBodyAsParameters = false;
		}
	}

	if (customOptions.protoBasePath == null) {
		console.log("No protoBasePath was specified");
		return 1;
	}

	if (customOptions.outPath == null) {
		console.log("No outPath was specified");
		return 1;
	}

	let options: ProgramOptions = {
		requestBodyAsParameters: customOptions.requestBodyAsParameters ?? true,
		serverName: customOptions.serverName ?? "Proto",
		protoBasePath: customOptions.protoBasePath,
		outPath: customOptions.outPath
	};

	let creator = new TypeDefinitionCreator(
		new TSWriter(
			new DefaultTransformer(), 
			options.requestBodyAsParameters,
			options.serverName
		)
	);
	let vd = await creator.Create(options.protoBasePath);
	await WriteVirtualDirectory(vd, options.outPath);
	return 0;
}

main(process.argv)
	.then((exitCode) => {
		process.exit(exitCode);
	})
	.catch((e) => {
		console.log(e);
		process.exit(1);
	})