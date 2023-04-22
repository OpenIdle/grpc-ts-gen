export interface FileConfig {
	protoBasePath: string;
	outPath: string;
	serverName: string;
	requestBodyAsObject: boolean;
	module: boolean;
}

export interface ProgramOptions {
	protoBasePath: string;
	outPath: string;
	requestBodyAsParameters: boolean;
	serverName: string;
	module: boolean;
}

export class InvalidOptionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidOptionError";
	}
}

export class OptionParser {
	GetConfig(args: string[], fileConfig: Partial<FileConfig>): ProgramOptions {
		const customOptions: Partial<ProgramOptions> = {};
		
		if ("protoBasePath" in fileConfig) {
			if (typeof(fileConfig.protoBasePath) != "string") {
				throw new InvalidOptionError("protoBasePath has to be a string");
			}
			customOptions.protoBasePath = fileConfig.protoBasePath;
		}
		if ("outPath" in fileConfig) {
			if (typeof(fileConfig.outPath) != "string") {
				throw new InvalidOptionError("outPath has to be a string");
			}
			customOptions.outPath = fileConfig.outPath;
		}
		if ("serverName" in fileConfig) {
			if (typeof(fileConfig.serverName) != "string") {
				throw new InvalidOptionError("serverName has to be a string");
			}
			customOptions.serverName = fileConfig.serverName;
		}
		if ("requestBodyAsObject" in fileConfig) {
			if (typeof(fileConfig.requestBodyAsObject) != "boolean") {
				throw new InvalidOptionError("requestBodyAsObject has to be a boolean");
			}
			customOptions.requestBodyAsParameters = !fileConfig.requestBodyAsObject;
		}
		if ("module" in fileConfig) {
			if (typeof(fileConfig.module) != "boolean") {
				throw new InvalidOptionError("module has to be a boolean");
			}
			customOptions.module = fileConfig.module;
		}

		for (let i = 2; i < args.length; i++) {
			if (i + 1 < args.length) {
				if (args[i].toLowerCase() == "--proto-base-path") {
					customOptions.protoBasePath = args[i + 1];
					i++;
					continue;
				} else if (args[i].toLowerCase() == "--out-path") {
					customOptions.outPath = args[i + 1];
					i++;
					continue;
				} else if (args[i].toLowerCase() == "--server-name") {
					customOptions.serverName = args[i + 1];
					i++;
					continue;
				}
			}
	
			if (args[i].toLowerCase() == "--request-body-as-object") {
				customOptions.requestBodyAsParameters = false;
			} else if (args[i].toLowerCase() == "--module") {
				customOptions.module = true;
			} else {
				throw new InvalidOptionError(`Unknown option: ${args[i]}`);
			}
		}

		if (customOptions.protoBasePath == null) {
			throw new InvalidOptionError("No protoBasePath was specified");
		}
	
		if (customOptions.outPath == null) {
			throw new InvalidOptionError("No outPath was specified");
		}

		const options: ProgramOptions = {
			requestBodyAsParameters: customOptions.requestBodyAsParameters ?? true,
			serverName: customOptions.serverName ?? "Proto",
			protoBasePath: customOptions.protoBasePath,
			outPath: customOptions.outPath,
			module:customOptions.module ?? false
		};

		return options;
	}
}
