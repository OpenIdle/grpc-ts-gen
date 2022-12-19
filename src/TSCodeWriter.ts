import { INamespace } from "protobufjs";
import CodeGenerator from "./CodeGenerator";
import { EnumDefinition, GrpcEnumType, GrpcMessageType, GrpcOneofType, GrpcSymbol, GrpcType, MessageDefinition, NamespacedSymbol, ProtoDefinition, ServiceDefinition, SymbolType } from "./GRPCDefinitionTranslator";
import { ICodeWriter } from "./ICodeWriter";
import { INamingTransformer } from "./INamingTransformer";
import { TSNamespaceCodeGenerator } from "./TSNamespaceCodeGenerator";
import { VirtualDirectory } from "./VirtualDirectory";

const STRING_TYPE_NAME = "string";
const NUMBER_TYPE_NAME = "number";

export class TSCodeWriter implements ICodeWriter {
	_definitionWriter: TSNamespaceCodeGenerator;
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
		this._definitionWriter = new TSNamespaceCodeGenerator(new CodeGenerator(), this._namingTransformer, "definitions.ts");
	}

	private GetFullSymbolName(symbol: NamespacedSymbol): string {
		return symbol.namespace
			.map(x => this._namingTransformer.ConvertSymbol(x))
			.join(".") + 
		"." + this._namingTransformer.ConvertSymbol(symbol.name);
	}

	private GetTSTypeName(type: GrpcType): string {
		if (type instanceof GrpcEnumType || type instanceof GrpcMessageType) {
			return this.GetFullSymbolName(type.symbol);
		}
		if (type instanceof GrpcOneofType) {
			return Object.values(type.definition)
				.map(x => this.GetTSTypeName(x))
				.join(" | ") + " | null";
		}
		switch (type.type) {
			case "string":
				return STRING_TYPE_NAME;
			case "int64":
				return NUMBER_TYPE_NAME;
			case "int32":
				return NUMBER_TYPE_NAME;
			case "uint32":
				return NUMBER_TYPE_NAME;
			default:
				throw new Error("Unknown type: " + type.type);
		}
	}

	WriteMessageInterface(message: MessageDefinition) {
		this._definitionWriter.Group(message.symbol.namespace, () => {
			this._definitionWriter.DefineInterface(message.symbol.name, () => {
				for (const field of message.fields) {
					this._definitionWriter.AddLine(`readonly ${field.symbol.name}: ${this.GetTSTypeName(field.type)};`);
				}
			});
		});
	}
	
	WriteEnum(_enum: EnumDefinition) {
		this._definitionWriter.Group(_enum.symbol.namespace, () => {
			this._definitionWriter.DefineEnum(_enum.symbol.name, () => {
				for (const value of _enum.values) {
					this._definitionWriter.AddLine(`${this._namingTransformer.ConvertSymbol(value.symbol)} = ${value.value},`);
				}
			});
		});
	}

	WriteServiceInterface(service: ServiceDefinition) {
		this._definitionWriter.Group(service.symbol.namespace, () => {
			this._definitionWriter.DefineInterface(service.symbol.name, () => {
				for (const method of service.methods) {
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

	WriteServer(protoDefinition: ProtoDefinition, pbjsDefinition: INamespace): void {

		const packageDefintionWriter = new CodeGenerator();

		packageDefintionWriter.AddLine(`export const protoJson: any = ${JSON.stringify(pbjsDefinition)};`);
		this._serviceWriters.push({name: "package_defintion", writer: packageDefintionWriter});
		
		const serverWriter = new CodeGenerator();

		const namespacesToImport: Set<string> = new Set();
		for (const service of protoDefinition.GetServices()) {
			namespacesToImport.add(service.symbol.namespace[0].name);
		}

		for (const unique_namespace of namespacesToImport) {
			serverWriter.AddLine(`import { ${this._namingTransformer.ConvertSymbol(new GrpcSymbol(unique_namespace, SymbolType.Namespace))} } from './definitions';`);
		}
		serverWriter.AddLine("import * as grpc from '@grpc/grpc-js';");
		serverWriter.AddLine("import {protoJson} from './package_defintion';");
		serverWriter.AddLine("import * as protoLoader from '@grpc/proto-loader';");
		serverWriter.AddLine("import {GrpcResponseError} from 'grpc-ts-gen';");

		const className = `${this._serverName}Server`;

		serverWriter.AddLine(`export class ${className} {`);
		serverWriter.Indent();
		serverWriter.AddLine("private _grpcServer: grpc.Server;");
		serverWriter.AddLine("get GrpcServer(): grpc.Server { return this._grpcServer; }");
		serverWriter.AddLine("private _packageDefinition: protoLoader.PackageDefinition;");

		serverWriter.AddLine("constructor() {");
		serverWriter.Indent();
		serverWriter.AddLine("this._grpcServer = new grpc.Server();");
		serverWriter.AddLine("this._packageDefinition = protoLoader.fromJSON(protoJson);");
		serverWriter.Unindent();
		serverWriter.AddLine("}");
		for (const service of protoDefinition.GetServices()) {
			serverWriter.AddLine(`Add${service.symbol.name.name}(service: ${this.GetFullSymbolName(service.symbol)}) {`);
			serverWriter.Indent();
			serverWriter.AddLine(`this._grpcServer.addService((this._packageDefinition as any).${this.GetFullSymbolName(service.symbol)}, {`);
			serverWriter.Indent();
			for (const method of service.methods) {
				serverWriter.AddLine(`${JSON.stringify(method.symbol.name)}: (callObject, callback) => {`);
				serverWriter.Indent();
				this.TranslateType("callObject.request", "translatedCallObject", serverWriter, method.inputType, protoDefinition);

				serverWriter.AddLine(`service.${this._namingTransformer.ConvertSymbol(method.symbol)}(translatedCallObject)`);
				serverWriter.Indent();
				serverWriter.AddLine(".then((response) => callback(null, response))");
				serverWriter.AddLine(".catch((err) => {");
				serverWriter.Indent();
				serverWriter.AddLine("if (err instanceof GrpcResponseError)");
				serverWriter.Indent();
				serverWriter.AddLine("callback({code: err.grpcErrorCode});");
				serverWriter.Unindent();
				serverWriter.AddLine("throw err;");
				serverWriter.Unindent();
				serverWriter.AddLine("})");
				serverWriter.Unindent();
				serverWriter.Unindent();
				serverWriter.AddLine("},");
			}
			serverWriter.Unindent();
			serverWriter.AddLine("});");
			serverWriter.Unindent();
			serverWriter.AddLine("}");
		}
		
		serverWriter.Unindent();
		serverWriter.AddLine("}");

		this._serviceWriters.push({name: className, writer: serverWriter});
	}

	private TranslateType(from: string, to: string, generator: CodeGenerator, type: GrpcType, protoDefinition: ProtoDefinition): void {
		if (type instanceof GrpcMessageType) {
			const message = protoDefinition.FindMessage(type.symbol);
			generator.AddLine(`const ${to} = {`);
			generator.Indent();
			for (const field of message.fields) {
				generator.AddLine(`${JSON.stringify(this._namingTransformer.ConvertSymbol(field.symbol))}: ${from}[${JSON.stringify(field.symbol.name)}],`);
			}
			generator.Unindent();
			generator.AddLine("}");
		} else {
			generator.AddLine(`const ${to} = ${from}`);

		}
	}

	GetResult(): VirtualDirectory {
		const vd = new VirtualDirectory();
		this._definitionWriter.Generate(vd);
		for (const serviceWriter of this._serviceWriters) {
			vd.AddEntry(serviceWriter.name, serviceWriter.writer.Generate());
		}
		return vd;
	}
}
