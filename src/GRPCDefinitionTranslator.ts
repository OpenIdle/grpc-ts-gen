import * as protoLoader from "@grpc/proto-loader";
import { common, INamespace } from "protobufjs";

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

type GrpcBuiltInTypeStrings = "MESSAGE" | "ENUM" | "ONEOF" | "string" | "uint32" | "int32" | "uint64" | "int64";
const GrpcBuiltInTypeSet: Set<GrpcBuiltInTypeStrings> = new Set(["MESSAGE", "ENUM", "ONEOF", "string", "uint32", "int32", "uint64", "int64"]);
export class GrpcType {
	type: GrpcBuiltInTypeStrings
	constructor(type: GrpcBuiltInTypeStrings) {
		this.type = type;
	}
}

export class GrpcMessageType extends GrpcType {
	symbol: NamespacedSymbol;
	constructor(symbol: NamespacedSymbol) {
		super("MESSAGE");
		this.symbol = symbol;
	}
}

export class GrpcEnumType extends GrpcType {
	symbol: NamespacedSymbol;
	constructor(symbol: NamespacedSymbol) {
		super("ENUM");
		this.symbol = symbol;
	}
}

export class GrpcOneofType extends GrpcType {
	definition: Record<string, GrpcType>;
	constructor(definition: Record<string, GrpcType>) {
		super("ONEOF");
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
	private constructor() {
		this.messages = new Map();
		this.services = new Map();
		this.enums = new Map();
	}
	
	static FromPbjs(root: INamespace): ProtoDefinition {
		let rv = new ProtoDefinition();

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
					for (let [eKey, eVal] of Object.entries(val.values)) {
						enumDefinition.values.push(
							new EnumValue(new GrpcSymbol(eKey, SymbolType.EnumValue), eVal)
						);
					}
					protoDefinition.enums.set(namespaces.join(".") + "." + key, enumDefinition);
				} else if ("fields" in val && val.fields != null) { // IType
					let messageDefinition = new MessageDefinition(
						new NamespacedSymbol(namespaces, new GrpcSymbol(key, SymbolType.Message)),
						[]
					);
					for (let [mKey, mVal] of Object.entries(val.fields)) {
						messageDefinition.fields.push(new MessageField(
							new GrpcSymbol(mKey, SymbolType.Field), 
							protoDefinition.ResolveGrpcType(namespaces, mVal.type)
						));
					}
					protoDefinition.messages.set(namespaces.join(".") + "." + key, messageDefinition);
				} else if ("methods" in val && val.methods != null) { //IService
					
				} else if ("nested" in val && val.nested != null) { //INamespace
					this.FromPbjsRecursive(namespaces.concat([new GrpcSymbol(key, SymbolType.Namespace)]), val, protoDefinition);
				} 
			}
		}
	}

	private ResolveGrpcType(namespaceScope: GrpcSymbol[], accessString: string): GrpcType {
		if (GrpcBuiltInTypeSet.has(accessString as GrpcBuiltInTypeStrings)) {
			return new GrpcType(accessString as GrpcBuiltInTypeStrings);
		}

		let message: MessageDefinition | undefined;
		let _enum: EnumDefinition | undefined;

		while (namespaceScope.length > 0) {
			let fullName = namespaceScope.join(".") + "." + accessString;
			if (message = this.messages.get(fullName))
				return new GrpcMessageType(message.symbol);

			if (_enum = this.enums.get(fullName))
				return new GrpcEnumType(_enum.symbol);
			namespaceScope.splice(namespaceScope.length-1);
		}
		if (message = this.messages.get(accessString))
			return new GrpcMessageType(message.symbol);
		
		if (_enum = this.enums.get(accessString))
			return new GrpcEnumType(_enum.symbol);

		throw new Error("refered to undefined object");
	}

	public GetMessages(): IterableIterator<MessageDefinition> {
		return this.messages.values();
	}

	public GetServices(): IterableIterator<ServiceDefinition> {
		return this.services.values();
	}

	public GetEnums(): IterableIterator<EnumDefinition> {
		return this.enums.values();
	}

	private messages: Map<string, MessageDefinition>;
	private services: Map<string, ServiceDefinition>;
	private enums: Map<string, EnumDefinition>;
}
