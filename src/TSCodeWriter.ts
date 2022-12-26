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
	_grpcTsGenModulePath: string;
	constructor(
		namingTransformer: INamingTransformer, 
		requestBodyAsParameters: boolean,
		serverName: string,
		grpcTsGenModulePath: string,
	) {
		this._namingTransformer = namingTransformer;
		this._requestBodyAsParameters = requestBodyAsParameters;
		this._serverName = serverName;
		this._definitionWriter = new TSCodeGenerator(this._namingTransformer);
		this._grpcTsGenModulePath = grpcTsGenModulePath;
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
					this._definitionWriter.AddLine(`readonly ${this._namingTransformer.ConvertSymbol(field.symbol)}: ${this.GetTSTypeNameAndImport(field.type, this._definitionWriter)};`);
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

	WriteServiceInterface(service: ServiceDefinition, protoDefinition: ProtoDefinition): void {
		this._definitionWriter.Group(service.symbol.namespace, () => {
			this._definitionWriter.DefineInterface(service.symbol.name, () => {
				for (const method of service.methods) {
					let parameters: string;
					if (this._requestBodyAsParameters) {
						parameters = "";
						const message = protoDefinition.FindMessage(method.inputType.symbol);
						parameters = message.fields.map((messageField) => `${this._namingTransformer.ConvertSymbol(messageField.symbol)}: ${this.GetTSTypeNameAndImport(messageField.type, this._definitionWriter)}`).join(", ");
					} else {
						parameters = "request: " + this.GetTSTypeNameAndImport(method.inputType, this._definitionWriter);
					}
					this._definitionWriter.AddLine(`${this._namingTransformer.ConvertSymbol(method.symbol)}: (${parameters}) => Promise<${this.GetTSTypeNameAndImport(method.outputType, this._definitionWriter)}>;`);
				}
			});
		});
	}

	private ImportSymbol(symbol: NamespacedSymbol): string {
		const importedName = "IMPORT_" + symbol.Assemble("_");
		this._definitionWriter.AddImport(symbol, importedName);
		return importedName;
	}

	WriteServer(protoDefinition: ProtoDefinition, pbjsDefinition: INamespace): void {
		const packageDefinitionSymbol = new NamespacedSymbol([new GrpcSymbol("_package_definition", SymbolType.Special)], new GrpcSymbol("protoJson", SymbolType.Special));
		this._definitionWriter.Group(packageDefinitionSymbol.namespace, () => {
			this._definitionWriter.AddLine("import { INamespace } from \"protobufjs\";");
			//casting to INamespace as a temporary fix until protobufjs definitions are correct
			this._definitionWriter.AddLine(`export const protoJson: INamespace = ${JSON.stringify(pbjsDefinition)} as INamespace;`);
		});
		
		const className = `${this._serverName}Server`;

		this._definitionWriter.Group([new GrpcSymbol(className, SymbolType.Special)], () => {
			this._definitionWriter.AddImport(packageDefinitionSymbol);
			this._definitionWriter.AddLine("import * as protoLoader from \"@grpc/proto-loader\";");
			
			this._definitionWriter.AddLine(`import {GrpcResponseError, IGrpcServerImplementation} from  ${JSON.stringify(this._grpcTsGenModulePath)};`);
			this._definitionWriter.AddLine(`export class ${className} {`);
			this._definitionWriter.Indent();
			this._definitionWriter.AddLine("private _grpcServer: IGrpcServerImplementation;");
			this._definitionWriter.AddLine("get GrpcServer(): IGrpcServerImplementation { return this._grpcServer; }");
			this._definitionWriter.AddLine("private _packageDefinition: protoLoader.PackageDefinition;");
			this._definitionWriter.AddLine("constructor(serverImplementation: IGrpcServerImplementation) {");
			this._definitionWriter.Indent();
			this._definitionWriter.AddLine("this._grpcServer = serverImplementation;");
			this._definitionWriter.AddLine("this._packageDefinition = protoLoader.fromJSON(protoJson);");
			this._definitionWriter.Unindent();
			this._definitionWriter.AddLine("}");
			for (const service of protoDefinition.GetServices()) {
				this._definitionWriter.AddLine(`Add${service.symbol.namespace.map((sym) => this._namingTransformer.ConvertSymbol(sym)).join("")}${this._namingTransformer.ConvertSymbol(service.symbol.name)}(service: ${this.ImportSymbol(service.symbol)}): void {`);
				this._definitionWriter.Indent();
				this._definitionWriter.AddLine(`this._grpcServer.addService<any>(this._packageDefinition[${JSON.stringify(service.symbol.Assemble())}] as protoLoader.ServiceDefinition, {`);
				this._definitionWriter.Indent();
				for (const method of service.methods) {
					this._definitionWriter.AddLine(`${JSON.stringify(method.symbol.name)}: (callObject, callback) => {`);
					this._definitionWriter.Indent();
					if (this._requestBodyAsParameters) {
						const message = protoDefinition.FindMessage(method.inputType.symbol);
						this._definitionWriter.AddLine(`service.${this._namingTransformer.ConvertSymbol(method.symbol)}(${message.fields.map((messageField) => `callObject.request.${messageField.symbol.name}`).join(", ")})`);
					} else {
						this.TransformType("callObject.request", "translatedCallObject", this._definitionWriter, method.inputType, protoDefinition);
						this._definitionWriter.AddLine(`service.${this._namingTransformer.ConvertSymbol(method.symbol)}(translatedCallObject)`);
					}
					this._definitionWriter.Indent();
					this._definitionWriter.AddLine(".then((response) => {");
					this._definitionWriter.IndentBlock(() => {
						this.UntransformType("response", "translatedResponse", this._definitionWriter, method.outputType, protoDefinition);
						this._definitionWriter.AddLine("callback(null, translatedResponse);");
					});
					this._definitionWriter.AddLine("})");
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

	private TransformType(from: string, to: string, generator: ICodeGenerator, type: GrpcMessageType, protoDefinition: ProtoDefinition): void {
		const message = protoDefinition.FindMessage(type.symbol);
		generator.AddLine(`const ${to} = {`);
		generator.Indent();
		for (const field of message.fields) {
			generator.AddLine(`${JSON.stringify(this._namingTransformer.ConvertSymbol(field.symbol))}: ${from}[${JSON.stringify(field.symbol.name)}],`);
		}
		generator.Unindent();
		generator.AddLine("}");
	}

	private UntransformType(from: string, to: string, generator: ICodeGenerator, type: GrpcMessageType, protoDefinition: ProtoDefinition): void {
		const message = protoDefinition.FindMessage(type.symbol);
		generator.AddLine(`const ${to} = {`);
		generator.Indent();
		for (const field of message.fields) {
			generator.AddLine(`${JSON.stringify(field.symbol.name)}: ${from}[${JSON.stringify(this._namingTransformer.ConvertSymbol(field.symbol))}],`);
		}
		generator.Unindent();
		generator.AddLine("}");
	}

	GetResult(): VirtualDirectory {
		const vd = new VirtualDirectory();
		this._definitionWriter.Generate(vd);
		return vd;
	}
}
