import { ServiceDefinition } from "@grpc/proto-loader";
import { join } from "path/posix";
import protobuf from "protobufjs";
import { IGrpcServerImplementation, Implementation } from "../src";
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

export class MockGrpcServerImplementation implements IGrpcServerImplementation {
	private _mockImplementations: Map<string, {methodName: string, impl: Implementation<unknown>}>;
	constructor() {
		this._mockImplementations = new Map();
	}
	
	addService(service: ServiceDefinition, implementation: Implementation<unknown>): void {
		for (const [key, value] of Object.entries(service)) {
			this._mockImplementations.set(value.path, {methodName: key, impl: implementation});
		}
		return;
	}


	async mockCall(path: string, callObject: unknown): Promise<{err: {code: number} | null, response?: unknown}> {
		const handler = this._mockImplementations.get(path);
		if (handler == null) {
			throw new Error("No hanlder for that path");
		}
		return await new Promise((resolve) => {
			handler.impl[handler.methodName]({request: callObject}, (err, response) => {
				if (err)
					resolve({err: err});
				resolve({err: null, response: response});
			});
		});
	}
}
