import { INamespace } from "protobufjs";
import { EnumDefinition, GrpcEnumType, GrpcMessageType, GrpcOneofType, GrpcSymbol, GrpcType, MessageDefinition, NamespacedSymbol, ProtoDefinition, ServiceDefinition, SymbolType } from "./GRPCDefinitionTranslator";
import { ICodeGenerator } from "./ICodeGenerator";
import { ICodeWriter } from "./ICodeWriter";
import { IModuleCodeGenerator } from "./IModuleCodeGenerator";
import { INamingTransformer } from "./INamingTransformer";
import { TSCodeGenerator, TSCodeGeneratorOptions } from "./TSCodeGenerator";
import { VirtualDirectory } from "./VirtualDirectory";

const STRING_TYPE_NAME = "string";
const NUMBER_TYPE_NAME = "number";

export interface TSCodeWriterOptions extends TSCodeGeneratorOptions {
	requestBodyAsParameters: boolean;
	serverName: string;
}

export class TSCodeWriter implements ICodeWriter {
	_definitionWriter: TSCodeGenerator;
	_grpcTsGenModulePath: string;
	constructor(
		private _namingTransformer: INamingTransformer,
		private _options: TSCodeWriterOptions,
		grpcTsGenModulePath: string,
	) {
		this._definitionWriter = new TSCodeGenerator(this._namingTransformer, _options);
		this._grpcTsGenModulePath = grpcTsGenModulePath;
	}

	private GetOneofType(type: GrpcOneofType, codeGenerator: IModuleCodeGenerator): string {
		return "{" + Object.entries(type.definition)
			.map(([name, type]) => {
				return `${this._namingTransformer.ConvertSymbol(new GrpcSymbol(name, SymbolType.Field))}?: ${this.GetTSTypeNameAndImport(type, codeGenerator)};`;
			})
			.join("") + "}";
	}

	private GetTSTypeNameAndImport(type: GrpcType, codeGenerator: IModuleCodeGenerator): string {
		if (type instanceof GrpcEnumType || type instanceof GrpcMessageType) {
			const importName = `IMPORT_${type.symbol.namespace.map(x => x.name).join("_")}_${type.symbol.name.name}`;
			codeGenerator.AddImport(type.symbol, importName);
			return importName;
		}
		if (type instanceof GrpcOneofType) {
			return this.GetOneofType(type, codeGenerator);
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
				for (const field of message.GetFields()) {
					this._definitionWriter.AddLine(`readonly ${this._namingTransformer.ConvertSymbol(field.symbol)}${field.optional ? "?" : ""}: ${this.GetTSTypeNameAndImport(field.type, this._definitionWriter)};`);
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
					if (this._options.requestBodyAsParameters) {
						parameters = "";
						const message = protoDefinition.FindMessage(method.inputType.symbol);
						parameters = Array.from(message.GetFields())
							.map((messageField) => 
								`${this._namingTransformer.ConvertSymbol(messageField.symbol)}: ${this.GetTSTypeNameAndImport(messageField.type, this._definitionWriter)}${messageField.optional ? " | undefined" : ""}`
							)
							.join(", ");
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
		
		const className = `${this._options.serverName}Server`;

		this._definitionWriter.Group([new GrpcSymbol(className, SymbolType.Special)], () => {
			this._definitionWriter.AddImport(packageDefinitionSymbol);
			if (this._options.module) {
				this._definitionWriter.AddLine("const protoLoader = await import(\"@grpc/proto-loader\");");
				this._definitionWriter.AddLine(`const {GrpcResponseError} = await import(${JSON.stringify(this._grpcTsGenModulePath)});`);
				this._definitionWriter.AddLine("const { Status } = await import(\"@grpc/grpc-js/build/src/constants.js\");");
			} else {
				this._definitionWriter.AddLine("import * as protoLoader from \"@grpc/proto-loader\";");
				this._definitionWriter.AddLine(`import {GrpcResponseError} from  ${JSON.stringify(this._grpcTsGenModulePath)};`);
				this._definitionWriter.AddLine("import { Status } from \"@grpc/grpc-js/build/src/constants\";");
			}
			this._definitionWriter.AddLine("import type { PackageDefinition, ServiceDefinition} from \"@grpc/proto-loader\";");
			this._definitionWriter.AddLine(`import type { IGrpcServerImplementation } from ${JSON.stringify(this._grpcTsGenModulePath)};`);
			this._definitionWriter.AddLine(`export class ${className} {`);
			this._definitionWriter.Indent();
			this._definitionWriter.AddLine("private _grpcServer: IGrpcServerImplementation;");
			this._definitionWriter.AddLine("get GrpcServer(): IGrpcServerImplementation { return this._grpcServer; }");
			this._definitionWriter.AddLine("private _packageDefinition: PackageDefinition;");
			this._definitionWriter.AddLine("constructor(serverImplementation: IGrpcServerImplementation) {");
			this._definitionWriter.Indent();
			this._definitionWriter.AddLine("this._grpcServer = serverImplementation;");
			this._definitionWriter.AddLine("this._packageDefinition = protoLoader.fromJSON(protoJson, {keepCase: true});");
			this._definitionWriter.Unindent();
			this._definitionWriter.AddLine("}");
			for (const service of protoDefinition.GetServices()) {
				this._definitionWriter.AddLine(`Add${service.symbol.namespace.map((sym) => this._namingTransformer.ConvertSymbol(sym)).join("")}${this._namingTransformer.ConvertSymbol(service.symbol.name)}(service: ${this.ImportSymbol(service.symbol)}): void {`);
				this._definitionWriter.Indent();
				this._definitionWriter.AddLine(`this._grpcServer.addService<any>(this._packageDefinition[${JSON.stringify(service.symbol.Assemble())}] as ServiceDefinition, {`);
				this._definitionWriter.Indent();
				for (const method of service.methods) {
					this._definitionWriter.AddLine(`${JSON.stringify(method.symbol.name)}: (callObject, callback) => {`);
					this._definitionWriter.Indent();
					if (this._options.requestBodyAsParameters) {
						const message = protoDefinition.FindMessage(method.inputType.symbol);
						this._definitionWriter.AddLine(`service.${this._namingTransformer.ConvertSymbol(method.symbol)}(`);
						this._definitionWriter.Indent();
						for (const field of message.GetFields()) {
							if (field.type instanceof GrpcMessageType || field.type instanceof GrpcOneofType) {
								this.TransformType(`callObject.request[${JSON.stringify(field.symbol.name)}]`, null, this._definitionWriter, field.type, protoDefinition, "forward");
							} else {
								this._definitionWriter.AddLine(`callObject.request[${JSON.stringify(field.symbol.name)}],`);
							}
						}
						this._definitionWriter.Unindent();
						this._definitionWriter.AddLine(")");
					} else {
						this.TransformType("callObject.request", "translatedCallObject", this._definitionWriter, method.inputType, protoDefinition, "forward");
						this._definitionWriter.AddLine(`service.${this._namingTransformer.ConvertSymbol(method.symbol)}(translatedCallObject)`);
					}
					this._definitionWriter.Indent();
					this._definitionWriter.AddLine(".then((response) => {");
					this._definitionWriter.IndentBlock(() => {
						this.TransformType("response", "translatedResponse", this._definitionWriter, method.outputType, protoDefinition, "reverse");
						this._definitionWriter.AddLine("callback(null, translatedResponse);");
					});
					this._definitionWriter.AddLine("})");
					this._definitionWriter.AddLine(".catch((err) => {");
					this._definitionWriter.Indent();
					this._definitionWriter.AddLine("if (err instanceof GrpcResponseError)");
					this._definitionWriter.Indent();
					this._definitionWriter.AddLine("callback({code: err.grpcErrorCode});");
					this._definitionWriter.Unindent();
					this._definitionWriter.AddLine("else");
					this._definitionWriter.Indent();
					this._definitionWriter.AddLine("callback({code: Status.INTERNAL});");
					this._definitionWriter.Unindent();
					this._definitionWriter.Unindent();
					this._definitionWriter.AddLine("});");
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
	
	private TransformType(from: string, to: string | null, generator: ICodeGenerator, type: GrpcMessageType | GrpcOneofType, protoDefinition: ProtoDefinition, conversion: "reverse" | "forward"): void {
		if (to != null) {
			generator.AddLine(`const ${to} = {`);
		} else {
			generator.AddLine("{");
		}
		generator.Indent();
		if (type instanceof GrpcMessageType) {
			this.TransformTypeInternal(from, generator, type, protoDefinition, conversion);
		} else if (type instanceof GrpcOneofType) {
			this.TransformOneofTypeInternal(from, generator, type, protoDefinition, conversion);
		} 
		generator.Unindent();
		if (to != null) {
			generator.AddLine("};");
		} else {
			generator.AddLine("},");
		}
	}

	private TransformTypeInternal(from: string, generator: ICodeGenerator, type: GrpcMessageType, protoDefinition: ProtoDefinition, conversion: "reverse" | "forward"): void {
		const message = protoDefinition.FindMessage(type.symbol);

		for (const field of message.GetFields()) {
			const fieldToSet = conversion == "forward" ?
				JSON.stringify(this._namingTransformer.ConvertSymbol(field.symbol)) : 
				JSON.stringify(field.symbol.name);
			const fieldToGet = conversion == "forward" ?
				`${from}[${JSON.stringify(field.symbol.name)}]` :
				`${from}[${JSON.stringify(this._namingTransformer.ConvertSymbol(field.symbol))}]`;

			if (field.type instanceof GrpcMessageType) {
				if (field.optional)
					generator.AddLine(`${fieldToSet}: (${fieldToGet} == undefined) ? undefined : {`);
				else
					generator.AddLine(`${fieldToSet}: {`);

				generator.Indent();
				this.TransformTypeInternal(fieldToGet, generator, field.type, protoDefinition, conversion);
				generator.Unindent();
				generator.AddLine("},");
			} else if (field.type instanceof GrpcOneofType) {
				generator.AddLine(`${fieldToSet}: ({`);
				generator.Indent();
				this.TransformOneofTypeInternal(fieldToGet, generator, field.type, protoDefinition, conversion);
				generator.Unindent();
				generator.AddLine("}),");
			} else {
				generator.AddLine(`${fieldToSet}: ${fieldToGet},`);
			}
		}
	}

	private TransformOneofTypeInternal(from: string, generator: ICodeGenerator, type: GrpcOneofType, protoDefinition: ProtoDefinition, conversion: "forward" | "reverse"): void {
		for (const [fieldName, fieldType] of Object.entries(type.definition)) {
			const fieldToSet = conversion == "forward" ?
				JSON.stringify(this._namingTransformer.ConvertSymbol(new GrpcSymbol(fieldName, SymbolType.Field))) :
				JSON.stringify(fieldName);
			const fieldToGet = conversion == "forward" ?
				`${from}[${JSON.stringify(fieldName)}]` :
				`${from}[${JSON.stringify(this._namingTransformer.ConvertSymbol(new GrpcSymbol(fieldName, SymbolType.Field)))}]`;
			if (fieldType instanceof GrpcMessageType) {
				generator.AddLine(`${fieldToSet}: (${fieldToGet} != undefined) ? {`);
				generator.Indent();
				this.TransformTypeInternal(fieldToGet, generator, fieldType, protoDefinition, conversion);
				generator.Unindent();
				generator.AddLine("} : undefined,");
			} else if (fieldType instanceof GrpcOneofType) {
				throw new Error("Oneof type cannot be contained in a oneof field");
			} else {
				generator.AddLine(`${fieldToSet}: (${fieldToGet} != undefined) ? ${fieldToGet} : undefined,`);
			}
		}
	}

	GetResult(): VirtualDirectory {
		const vd = new VirtualDirectory();
		this._definitionWriter.Generate(vd);
		return vd;
	}
}
