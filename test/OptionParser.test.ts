import { assert } from "chai";
import { FileConfig, OptionParser } from "../src/OptionParser";

describe("OptionParser tests", () => {
	it("should throw an error if options are not the correct type", () => {
		assert.throw(() => {
			const optionParser = new OptionParser();
			optionParser.GetConfig(["npx", "grpc-ts-gen"], { protoBasePath: 1 } as unknown as Partial<FileConfig>);
		}, "protoBasePath has to be a string");
		assert.throw(() => {
			const optionParser = new OptionParser();
			optionParser.GetConfig(["npx", "grpc-ts-gen"], { outPath: 1 } as unknown as Partial<FileConfig>);
		}, "outPath has to be a string");
		assert.throw(() => {
			const optionParser = new OptionParser();
			optionParser.GetConfig(["npx", "grpc-ts-gen"], { serverName: 1 } as unknown as Partial<FileConfig>);
		}, "serverName has to be a string");
		assert.throw(() => {
			const optionParser = new OptionParser();
			optionParser.GetConfig(["npx", "grpc-ts-gen"], { requestBodyAsObject: "true" } as unknown as Partial<FileConfig>);
		}, "requestBodyAsObject has to be a boolean");
	});
	it("Should be able to set file options", () => {
		const optionParser = new OptionParser();
		const options = optionParser.GetConfig(["npx", "grpc-ts-gen"], { protoBasePath: "test", outPath: "test", serverName: "test", requestBodyAsObject: true });
		assert.equal(options.protoBasePath, "test");
		assert.equal(options.outPath, "test");
		assert.equal(options.serverName, "test");
		assert.equal(options.requestBodyAsParameters, false);
	});
	it("Should be able to set command line options", () => {
		const optionParser = new OptionParser();
		const options = optionParser.GetConfig(["npx", "grpc-ts-gen", "--proto-base-path", "test", "--out-path", "test", "--server-name", "test", "--request-body-as-object"], {});
		assert.equal(options.protoBasePath, "test");
		assert.equal(options.outPath, "test");
		assert.equal(options.serverName, "test");
		assert.equal(options.requestBodyAsParameters, false);
	});
	it("Should throw an error if no protoBasePath is specified", () => {
		assert.throw(() => {
			const optionParser = new OptionParser();
			optionParser.GetConfig(["npx", "grpc-ts-gen"], {"outPath": "test"});
		}, "No protoBasePath was specified");
	});
	it("Should throw an error if no outPath is specified", () => {
		assert.throw(() => {
			const optionParser = new OptionParser();
			optionParser.GetConfig(["npx", "grpc-ts-gen"], {"protoBasePath": "test"});
		}, "No outPath was specified");
	});
	it("CLI options should overwrite file options", () => {
		const optionParser = new OptionParser();
		const options = optionParser.GetConfig(["npx", "grpc-ts-gen", "--proto-base-path", "test", "--out-path", "test", "--server-name", "test", "--request-body-as-object"], { protoBasePath: "test2", outPath: "test2", serverName: "test2", requestBodyAsObject: true });
		assert.equal(options.protoBasePath, "test");
		assert.equal(options.outPath, "test");
		assert.equal(options.serverName, "test");
		assert.equal(options.requestBodyAsParameters, false);
	});
	it("default options should be set if no options are specified", () => {
		const optionParser = new OptionParser();
		const options = optionParser.GetConfig(["npx", "grpc-ts-gen"], {
			protoBasePath: "test",
			outPath: "test"
		});
		assert.equal(options.protoBasePath, "test");
		assert.equal(options.outPath, "test");
		assert.equal(options.serverName, "Proto");
		assert.equal(options.requestBodyAsParameters, true);
	});
	it("Should throw and error if an unknown option is speicified", () => {
		assert.throw(() => {
			const optionParser = new OptionParser();
			optionParser.GetConfig(["npx", "grpc-ts-gen", "--unknown-option"], {});
		}, "Unknown option: --unknown-option");
	});
});
