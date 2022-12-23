#!/usr/bin/env node

import { readFile } from "fs/promises";
import { TSCodeWriter } from "./TSCodeWriter";
import { DefaultTransformer } from "./DefaultTransformer";
import { TypeGenerator } from "./TypeGenerator";

interface FileConfig {
	protoBasePath: string;
	outPath: string;
	serverName: string;
	requestBodyAsObject: boolean;
}

interface ProgramOptions {
	protoBasePath: string;
	outPath: string;
	requestBodyAsParameters: boolean;
	serverName: string;
}

async function main(args: string[]): Promise<number> {
	const customOptions: Partial<ProgramOptions> = {};

	try {
		const configFile = await readFile("grpc-ts-gen.config.json");
		const fileConfig = JSON.parse(configFile.toString()) as Partial<FileConfig>;
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
		if (e == null || typeof(e) != "object" || (e as Record<string, string>).code != "ENOENT") {
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
				i++;
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

	const options: ProgramOptions = {
		requestBodyAsParameters: customOptions.requestBodyAsParameters ?? true,
		serverName: customOptions.serverName ?? "Proto",
		protoBasePath: customOptions.protoBasePath,
		outPath: customOptions.outPath
	};

	const creator = new TypeGenerator(
		new TSCodeWriter(
			new DefaultTransformer(), 
			options.requestBodyAsParameters,
			options.serverName,
			"grpc-ts-gen"
		)
	);
	const vd = await creator.Create(options.protoBasePath);
	await vd.WriteVirtualDirectory(options.outPath);
	return 0;
}

main(process.argv)
	.then((exitCode) => {
		process.exit(exitCode);
	})
	.catch((e) => {
		console.log(e);
		process.exit(1);
	});
