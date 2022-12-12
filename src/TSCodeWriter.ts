import { PackageDefinition } from "@grpc/proto-loader";
import { INamespace } from "protobufjs";
import CodeGenerator from "./CodeGenerator";
import { EnumDefinition, GrpcEnumType, GrpcMessageType, GrpcSymbol, GrpcType, MessageDefinition, NamespacedSymbol, ServiceDefinition, SymbolType } from "./GRPCDefinitionTranslator";
import { ICodeWriter } from "./ICodeWriter";
import { INamingTransformer } from "./INamingTransformer";
import { TSCodeGenerator } from "./TSCodeGenerator";
import { VirtualDirectory } from "./VirtualDirectory";

const STRING_TYPE_NAME = "string";
const NUMBER_TYPE_NAME = "number";

export class TSWriter implements ICodeWriter {
	_definitionWriter: TSCodeGenerator;
	_serviceWriters: {name: string, writer: CodeGenerator}[];
	_namingTransformer: INamingTransformer;
	_requestBodyAsParameters: boolean;
	_serverName: string;
	constructor(
		namingTransformer: INamingTransformer, 
		requestBodyAsParameters: boolean,
		serverName: string,
	) {
		this._namingTransformer = namingTransformer;
		this._requestBodyAsParameters = requestBodyAsParameters;
		this._serviceWriters = [];
		this._serverName = serverName;
		this._definitionWriter = new TSCodeGenerator(new CodeGenerator(), this._namingTransformer);
	}

	private GetFullSymbolName(symbol: NamespacedSymbol): string {
		return symbol.namespace
		.map(x => this._namingTransformer.ConvertSymbol(x))
		.join(".") + 
		"." + this._namingTransformer.ConvertSymbol(symbol.name);
	}

	private GetTSTypeName(type: GrpcType): string {
		if (type instanceof GrpcEnumType || type instanceof GrpcMessageType) {
			return this.GetFullSymbolName(type.symbol)
		}
		switch (type.type) {
			case "TYPE_STRING":
				return STRING_TYPE_NAME;
			case "TYPE_INT64":
				return NUMBER_TYPE_NAME;
			case "TYPE_INT32":
				return NUMBER_TYPE_NAME;
			case "TYPE_UINT32":
				return NUMBER_TYPE_NAME;
			default:
				throw new Error("Unknown type: " + type.type);
		}
	}

	WriteMessageInterface(message: MessageDefinition) {
		this._definitionWriter.Namespace(message.symbol.namespace, () => {
			this._definitionWriter.DefineInterface(message.symbol.name, () => {
				for (let field of message.fields) {
					this._definitionWriter.AddLine(`readonly ${field.symbol.name}: ${this.GetTSTypeName(field.type)};`)
				}
			});
		});
	}
	
	WriteEnum(_enum: EnumDefinition) {
		this._definitionWriter.Namespace(_enum.symbol.namespace, () => {
			this._definitionWriter.DefineEnum(_enum.symbol.name, () => {
				for (let value of _enum.values) {
					this._definitionWriter.AddLine(`${this._namingTransformer.ConvertSymbol(value.symbol)} = ${value.value},`);
				}
			});
		});
	}

	/*private GenerateParameterList(descriptor: protoLoader.MessageTypeDefinition): string {
		let parameters: string[] = [];

		for (let field of (descriptor.type as any).field) {
			parameters.push(`${field.name}: ${this.GetTSTypeName(field.type, field.typeName)}`);
		}

		return parameters.join(", ")
	}*/

	WriteServiceInterface(service: ServiceDefinition) {
		this._definitionWriter.Namespace(service.symbol.namespace, () => {
			this._definitionWriter.DefineInterface(service.symbol.name, () => {
				for (let method of service.methods) {
					let parameters: string;
					if (this._requestBodyAsParameters) {
						throw new Error("nyi");
					} else {
						parameters = "request: " + this.GetTSTypeName(method.inputType);
					}
					this._definitionWriter.AddLine(`${method.symbol.name}: (${parameters}) => Promise<${this.GetTSTypeName(method.outputType)}>;`);
				}
			});
		});
	}

	private WriteServiceServer(name: string, service: ServiceDefinition) {
		/*let nameParsed = ParseName(name);
		let fileDescriptorProtos: any = Object.values(service)[0].requestType.fileDescriptorProtos
		
		let serviceDescriptionWriter = new CodeGenerator();
		serviceDescriptionWriter.AddLine(`const FILE_DESCRIPTOR_PROTOS = ${JSON.stringify(fileDescriptorProtos)}`);
		
		let definitionString = JSON.stringify(service, (key, val) => key == "fileDescriptorProtos" ? "#!#!FILE_DESCRIPTOR_PROTOS!#!#" : val)
			.replaceAll("\"#!#!FILE_DESCRIPTOR_PROTOS!#!#\"", "FILE_DESCRIPTOR_PROTOS");
			serviceDescriptionWriter.AddLine(`export const DEFINITION = ${definitionString}`)

		this._serviceWriters.push({name: nameParsed.name + ".definition", writer: serviceDescriptionWriter})
		
		let writer = new CodeGenerator();
		
		const className = nameParsed.name + "Server";
		let versionNamespace = nameParsed.namespaces[nameParsed.namespaces.length - 1];
		writer.AddLine(`import {DEFINITION} from "./${nameParsed.name + ".definition"}"`);
		writer.AddLine(``);
		
		writer.AddLine(`export namespace ${versionNamespace} {`);
		writer.Indent();
		writer.AddLine(`export interface I${className}Server {`)
		writer.Indent();

		writer.Unindent(),
		writer.AddLine("}");
		writer.Unindent(),
		writer.AddLine("}");

		this._serviceWriters.push({name: className, writer: writer})*/
	}

	WriteServer(services: ServiceDefinition[], packageDefinition: PackageDefinition, pbjsDefinition: INamespace): void {
		//Find fileDescriptorProtos
		let fileDescriptorProtos = Object
			.values(packageDefinition)
			.filter((def) => def.format == 'Protocol Buffer 3 DescriptorProto')
			[0]
			.fileDescriptorProtos;

		let packageDefintionWriter = new CodeGenerator();

		packageDefintionWriter.AddLine(`export const protoJson: any = ${JSON.stringify(pbjsDefinition)};`);
		this._serviceWriters.push({name: "package_defintion", writer: packageDefintionWriter})
		
		let serverWriter = new CodeGenerator();

		let namespacesToImport: Set<string> = new Set();
		for (let service of services) {
			namespacesToImport.add(service.symbol.namespace[0].name);
		}

		for (let unique_namespace of namespacesToImport) {
			serverWriter.AddLine(`import { ${this._namingTransformer.ConvertSymbol(new GrpcSymbol(unique_namespace, SymbolType.Namespace))} } from './definitions';`);
		}
		serverWriter.AddLine(`import * as grpc from '@grpc/grpc-js';`);
		serverWriter.AddLine(`import {protoJson} from './package_defintion';`);
		serverWriter.AddLine(`import * as protoLoader from '@grpc/proto-loader';`);

		let className = `${this._serverName}Server`;

		serverWriter.AddLine(`export class ${className} {`);
		serverWriter.Indent();
		serverWriter.AddLine(`private _grpcServer: grpc.Server;`);
		serverWriter.AddLine(`get GrpcServer(): grpc.Server { return this._grpcServer; }`);
		serverWriter.AddLine(`private _packageDefinition: protoLoader.PackageDefinition;`);

		serverWriter.AddLine(`constructor() {`);
		serverWriter.Indent();
		serverWriter.AddLine(`this._grpcServer = new grpc.Server();`);
		serverWriter.AddLine(`this._packageDefinition = protoLoader.fromJSON(protoJson);`);
		serverWriter.Unindent();
		serverWriter.AddLine(`}`);
		for (let service of services) {
			serverWriter.AddLine(`Add${service.symbol.name.name}(service: ${this.GetFullSymbolName(service.symbol)}) {`);
			serverWriter.Indent();
			serverWriter.AddLine(`this._grpcServer.addService((this._packageDefinition as any).${this.GetFullSymbolName(service.symbol)}, service as any);`);
			serverWriter.Unindent();
			serverWriter.AddLine(`}`);
		}
		
		serverWriter.Unindent();
		serverWriter.AddLine("}");

		this._serviceWriters.push({name: className, writer: serverWriter});
	}

	GetResult(): VirtualDirectory {
		return {
			entries: new Map([
				["definitions.ts", this._definitionWriter.Generate()],
				...this._serviceWriters.map<[string, string]>(serviceWriter => [serviceWriter.name + ".ts", serviceWriter.writer.Generate()])
			]),
		};
	}
}