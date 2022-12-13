import * as protoLoader from "@grpc/proto-loader";
import { INamespace } from "protobufjs";

export enum SymbolType {
	Namespace,
	Enum,
	EnumValue,
	Service,
	Procedure,
	Field,
	Message
}

export class GrpcSymbol {

	constructor(name: string, type: SymbolType) {
		this.name = name;
		this.type = type;
	}

	Decompose(): string[] {
		if (this.name.length == 0) {
			return [""];
		}

		let allCharactersUppercase = true;
		for (let c of this.name) {
			if (c.toUpperCase() != c) {
				allCharactersUppercase = false;
				break;
			}
		}

		if (allCharactersUppercase) {
			//Screaming snake case
			return this.name.split("_").map(part => part.toLowerCase());
		} else {
			//either snake case, pascal case, camel case or a mix
			return this.name
				.split("_")
				.map((part) => {
					let splitted = [];
					let acc = "";
					for (let i = 0; i < part.length; i++) {
						let c = part.charAt(i);
						if (c.toUpperCase() == c) {
							if (acc.length != 0) {
								splitted.push(acc);
							}
							acc = c;
						} else {
							acc += c;
						}
					}
					if (acc.length != 0) {
						splitted.push(acc);
					}
					return splitted;
				})
				.flat()
				.map(x => x.toLowerCase());
		}
	}
	name: string;
	type: SymbolType;
}

export class NamespacedSymbol {
	constructor(namespace: GrpcSymbol[], name: GrpcSymbol) {
		this.namespace = namespace;
		this.name = name;
	}

	static FromString(fullName: string, symbolType: SymbolType): NamespacedSymbol {
		let split = fullName.split(".");
		let [name] = split.splice(split.length - 1, 1);
		return new NamespacedSymbol(
			split.map(x => new GrpcSymbol(x, SymbolType.Namespace)),
			new GrpcSymbol(name, symbolType)
		);
	}

	namespace: GrpcSymbol[];
	name: GrpcSymbol;
}

type GrpcBuiltInTypeStrings = "TYPE_MESSAGE" | "TYPE_ENUM" | "TYPE_ONEOF" | "TYPE_STRING" | "TYPE_INT64" | "TYPE_INT32" | "TYPE_UINT32";

export class GrpcType {
	type: GrpcBuiltInTypeStrings
	constructor(type: GrpcBuiltInTypeStrings) {
		this.type = type;
	}
}

export class GrpcMessageType extends GrpcType {
	symbol: NamespacedSymbol;
	constructor(symbol: NamespacedSymbol) {
		super("TYPE_MESSAGE");
		this.symbol = symbol;
	}
}

export class GrpcEnumType extends GrpcType {
	symbol: NamespacedSymbol;
	constructor(symbol: NamespacedSymbol) {
		super("TYPE_ENUM");
		this.symbol = symbol;
	}
}

export class GrpcOneofType extends GrpcType {
	definition: Record<string, GrpcType>;
	constructor(definition: Record<string, GrpcType>) {
		super("TYPE_ONEOF");
		this.definition = definition;
	}
}

export class MessageField {
	constructor(symbol: GrpcSymbol, type: GrpcType) {
		this.symbol = symbol;
		this.type = type;
	}
	symbol: GrpcSymbol;
	type: GrpcType;
}

export class MessageDefinition {
	constructor(symbol: NamespacedSymbol, fields: MessageField[]) {
		this.symbol = symbol;
		this.fields = fields;
	}
	symbol: NamespacedSymbol;
	fields: MessageField[];
}

export class ServiceMethod {
	constructor(symbol: GrpcSymbol, inputType: GrpcType, outputType: GrpcType) {
		this.symbol = symbol;
		this.inputType = inputType;
		this.outputType = outputType;
	}
	symbol: GrpcSymbol;
	inputType: GrpcType;
	outputType: GrpcType;
}

export class ServiceDefinition {
	constructor(symbol: NamespacedSymbol, methods: ServiceMethod[]) {
		this.symbol = symbol;
		this.methods = methods;
	}
	symbol: NamespacedSymbol;
	methods: ServiceMethod[];

}

export class EnumValue {
	constructor(symbol: GrpcSymbol, value: number) {
		this.symbol = symbol;
		this.value = value;
	}
	symbol: GrpcSymbol;
	value: number;
}

export class EnumDefinition {
	constructor(symbol: NamespacedSymbol, values: EnumValue[]) {
		this.symbol = symbol;
		this.values = values;
	}
	symbol: NamespacedSymbol;
	values: EnumValue[];
}

export class ProtoDefinition {
	constructor(messages: MessageDefinition[], services: ServiceDefinition[], enums: EnumDefinition[]) {
		this.messages = messages;
		this.services = services;
		this.enums = enums;
	}

	static FromPackageDefinition(packageDefinition: protoLoader.PackageDefinition): ProtoDefinition {
		let rv = new ProtoDefinition([], [], []);
		let rawServices: [string, protoLoader.ServiceDefinition][] = [];
		for (let [key, proto] of Object.entries(packageDefinition)) {
			if ("format" in proto && proto.format == 'Protocol Buffer 3 DescriptorProto') {
				let symbol = NamespacedSymbol.FromString(key, SymbolType.Message);
				console.log(key, JSON.stringify(proto.type, null, 4));
				let fields: MessageField[] = [];
				for (let field of ((proto.type as any).field as any[])) {
					let type: GrpcType;
					if (field.type == "TYPE_ENUM") {
						type = new GrpcEnumType(NamespacedSymbol.FromString(field.typeName, SymbolType.Enum))
					} else if (field.type == "TYPE_MESSAGE") {
						type = new GrpcMessageType(NamespacedSymbol.FromString(field.typeName, SymbolType.Enum))
					} else {
						type = new GrpcType(field.type);
					}
					fields.push(new MessageField(
						new GrpcSymbol(field.name, SymbolType.Field),
						type
					));
				}
				rv.messages.push(new MessageDefinition(symbol, fields));
			} else if ("format" in proto && proto.format == 'Protocol Buffer 3 EnumDescriptorProto') {
				let symbol = NamespacedSymbol.FromString(key, SymbolType.Enum);
				let values: EnumValue[] = [];
				for (let value of (proto.type as any).value) {
					values.push(new EnumValue(new GrpcSymbol(value.name, SymbolType.EnumValue), value.number));
				}
				rv.enums.push(new EnumDefinition(symbol, values));
			} else {
				rawServices.push([key, proto]);
			}
		}
		for (let [key, proto] of rawServices) {
			let symbol = NamespacedSymbol.FromString(key, SymbolType.Service);
			let methods: ServiceMethod[] = [];

			for (let [key, procedure] of Object.entries(proto)) {
				let method_symbol = new GrpcSymbol(key, SymbolType.Procedure);
				let requestName = (procedure.requestType.type as any).name;
				let responseName = (procedure.responseType.type as any).name;

				let inputType = new GrpcMessageType(new NamespacedSymbol(symbol.namespace, new GrpcSymbol(requestName, SymbolType.Message)));
				let outputType = new GrpcMessageType(new NamespacedSymbol(symbol.namespace, new GrpcSymbol(responseName, SymbolType.Message)));
				
				methods.push(new ServiceMethod(method_symbol, inputType, outputType));
			}

			rv.services.push(new ServiceDefinition(symbol, methods));
		}
		return rv;
	}
	
	static FromPbjs(root: INamespace): ProtoDefinition {
		let rv = new ProtoDefinition([], [], []);
		this.FromPbjsRecursive([], root, rv);
		return rv;
	}

	private static FromPbjsRecursive(namespaces: GrpcSymbol[], root: INamespace, protoDefinition: ProtoDefinition): void {
		if (root.nested != null) {
			for (let [key, val] of Object.entries(root.nested)) {
				if ("values" in val && val.values != null) { //IEnum
					let enumDefinition = new EnumDefinition(
						new NamespacedSymbol(namespaces, new GrpcSymbol(key, SymbolType.Enum)),
						[]
					);
					for (let [eKey, eVal] of Object.entries(protoDefinition.enums.values)) {
						enumDefinition.values.push(
							new EnumValue(new GrpcSymbol(eKey, SymbolType.EnumValue), eVal)
						);
					}
					protoDefinition.enums.push(enumDefinition);
				} else if ("fields" in val && val.fields != null) { // IType
					let messageDefinition = new MessageDefinition(
						new NamespacedSymbol(namespaces, new GrpcSymbol(key, SymbolType.Message)),
						[]
					);
					for (let [mKey, mVal] of Object.entries(val.fields)) {
						console.log(mVal);
					}
				} else if ("methods" in val && val.methods != null) { //IService
					
				} else if ("nested" in val && val.nested != null) { //INamespace
					this.FromPbjs(namespaces.concat([new GrpcSymbol(key, SymbolType.Namespace)]), val.nested, protoDefinition);
				} 
			}
		}
	}

	messages: MessageDefinition[];
	services: ServiceDefinition[];
	enums: EnumDefinition[];
}