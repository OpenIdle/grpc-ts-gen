import { INamespace } from "protobufjs";
import { EnumDefinition, GrpcEnumType, GrpcMessageType, GrpcOneofType, GrpcSymbol, GrpcType, MessageDefinition, NamespacedSymbol, ProtoDefinition, ServiceDefinition, SymbolType } from "./GRPCDefinitionTranslator";
import { ICodeGenerator } from "./ICodeGenerator";
import { ICodeWriter } from "./ICodeWriter";
import { IModuleCodeGenerator } from "./IModuleCodeGenerator";
import { INamingTransformer } from "./INamingTransformer";
import { TSCodeGenerator } from "./TSCodeGenerator";
import { VirtualDirectory } from "./VirtualDirectory";

const STRING_TYPE_NAME = "string";
const NUMBER_TYPE_NAME = "number";

export class TSCodeWriter implements ICodeWriter {
	_definitionWriter: TSCodeGenerator;
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
		this._serverName = serverName;
		this._definitionWriter = new TSCodeGenerator(this._namingTransformer);
	}

	private GetFullSymbolName(symbol: NamespacedSymbol): string {
		return symbol.namespace
			.map(x => this._namingTransformer.ConvertSymbol(x))
			.join(".") + 
		"." + this._namingTransformer.ConvertSymbol(symbol.name);
	}

	private GetTSTypeNameAndImport(type: GrpcType, codeGenerator: IModuleCodeGenerator): string {
		if (type instanceof GrpcEnumType || type instanceof GrpcMessageType) {
			const importName = `IMPORT_${type.symbol.namespace.map(x => x.name).join("_")}_${type.symbol.name.name}`;
			codeGenerator.AddImport(type.symbol, importName);
			return importName;
		}
		if (type instanceof GrpcOneofType) {
			return Object.values(type.definition)
				.map(x => this.GetTSTypeNameAndImport(x, codeGenerator))
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

	WriteMessageInterface(message: MessageDefinition): void {
		this._definitionWriter.Group(message.symbol.namespace, () => {
			this._definitionWriter.DefineInterface(message.symbol.name, () => {
				for (const field of message.fields) {
					this._definitionWriter.AddLine(`readonly ${field.symbol.name}: ${this.GetTSTypeNameAndImport(field.type, this._definitionWriter)};`);
				}
			});
		});
	}
	
	WriteEnum(_enum: EnumDefinition): void {
		this._definitionWriter.Group(_enum.symbol.namespace, () => {
			this._definitionWriter.DefineEnum(_enum.symbol.name, () => {
				for (const value of _enum.values) {
					this._definitionWriter.AddLine(`${this._namingTransformer.ConvertSymbol(value.symbol)} = ${value.value},`);
				}
			});
		});
	}

	WriteServiceInterface(service: ServiceDefinition): void {
		this._definitionWriter.Group(service.symbol.namespace, () => {
			this._definitionWriter.DefineInterface(service.symbol.name, () => {
				for (const method of service.methods) {
					let parameters: string;
					if (this._requestBodyAsParameters) {
						throw new Error("nyi");
					} else {
						parameters = "request: " + this.GetTSTypeNameAndImport(method.inputType, this._definitionWriter);
					}
					this._definitionWriter.AddLine(`${method.symbol.name}: (${parameters}) => Promise<${this.GetTSTypeNameAndImport(method.outputType, this._definitionWriter)}>;`);
				}
			});
		});
	}

	WriteServer(protoDefinition: ProtoDefinition, pbjsDefinition: INamespace): void {
		const packageDefinitionSymbol = new NamespacedSymbol([new GrpcSymbol("_package_definition", SymbolType.Special)], new GrpcSymbol("protoJson", SymbolType.Special));
		this._definitionWriter.Group(packageDefinitionSymbol.namespace, () => {
			this._definitionWriter.AddLine(`export const protoJson: any = ${JSON.stringify(pbjsDefinition)};`);
		});
		
		const className = `${this._serverName}Server`;

		this._definitionWriter.Group([new GrpcSymbol(className, SymbolType.Special)], () => {
			this._definitionWriter.AddImport(packageDefinitionSymbol);
			this._definitionWriter.AddLine("import * as grpc from '@grpc/grpc-js';");
			this._definitionWriter.AddLine("import * as protoLoader from '@grpc/proto-loader';");
			
			this._definitionWriter.AddLine("import {GrpcResponseError} from 'grpc-ts-gen';");
			this._definitionWriter.AddLine(`export class ${className} {`);
			this._definitionWriter.Indent();
			this._definitionWriter.AddLine("private _grpcServer: grpc.Server;");
			this._definitionWriter.AddLine("get GrpcServer(): grpc.Server { return this._grpcServer; }");
			this._definitionWriter.AddLine("private _packageDefinition: protoLoader.PackageDefinition;");
			this._definitionWriter.AddLine("constructor() {");
			this._definitionWriter.Indent();
			this._definitionWriter.AddLine("this._grpcServer = new grpc.Server();");
			this._definitionWriter.AddLine("this._packageDefinition = protoLoader.fromJSON(protoJson);");
			this._definitionWriter.Unindent();
			this._definitionWriter.AddLine("}");
			for (const service of protoDefinition.GetServices()) {
				this._definitionWriter.AddImport(service.symbol);

				this._definitionWriter.AddLine(`Add${service.symbol.name.name}(service: ${this.GetFullSymbolName(service.symbol)}) {`);
				this._definitionWriter.Indent();
				this._definitionWriter.AddLine(`this._grpcServer.addService((this._packageDefinition as any).${this.GetFullSymbolName(service.symbol)}, {`);
				this._definitionWriter.Indent();
				for (const method of service.methods) {
					this._definitionWriter.AddLine(`${JSON.stringify(method.symbol.name)}: (callObject, callback) => {`);
					this._definitionWriter.Indent();
					this.TranslateType("callObject.request", "translatedCallObject", this._definitionWriter, method.inputType, protoDefinition);
	
					this._definitionWriter.AddLine(`service.${this._namingTransformer.ConvertSymbol(method.symbol)}(translatedCallObject)`);
					this._definitionWriter.Indent();
					this._definitionWriter.AddLine(".then((response) => callback(null, response))");
					this._definitionWriter.AddLine(".catch((err) => {");
					this._definitionWriter.Indent();
					this._definitionWriter.AddLine("if (err instanceof GrpcResponseError)");
					this._definitionWriter.Indent();
					this._definitionWriter.AddLine("callback({code: err.grpcErrorCode});");
					this._definitionWriter.Unindent();
					this._definitionWriter.AddLine("throw err;");
					this._definitionWriter.Unindent();
					this._definitionWriter.AddLine("})");
					this._definitionWriter.Unindent();
					this._definitionWriter.Unindent();
					this._definitionWriter.AddLine("},");
				}
				this._definitionWriter.Unindent();
				this._definitionWriter.AddLine("});");
				this._definitionWriter.Unindent();
				this._definitionWriter.AddLine("}");
			}
			
			this._definitionWriter.Unindent();
			this._definitionWriter.AddLine("}");
		});
	}

	private TranslateType(from: string, to: string, generator: ICodeGenerator, type: GrpcType, protoDefinition: ProtoDefinition): void {
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
		return vd;
	}
}
