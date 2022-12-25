import { readFile } from "fs/promises";
import { DefaultTransformer } from "./DefaultTransformer";
import { FileConfig, OptionParser } from "./OptionParser";
import { TSCodeWriter } from "./TSCodeWriter";
import { TypeGenerator } from "./TypeGenerator";

export class Program {
	static async Main(args: string[]): Promise<number> {
		let fileConfig: Partial<FileConfig> = {};
		try {
			const configFile = await readFile("grpc-ts-gen.config.json");
			fileConfig = JSON.parse(configFile.toString()) as Partial<FileConfig>;
		} catch (e) {
			if (e == null || typeof(e) != "object" || (e as Record<string, string>).code != "ENOENT") {
				throw e;
			}
		}
		const optionParser = new OptionParser();
		const options = optionParser.GetConfig(args, fileConfig);

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
}
