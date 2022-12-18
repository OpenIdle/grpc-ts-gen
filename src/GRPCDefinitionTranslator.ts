import * as protoLoader from "@grpc/proto-loader";
import { common, IEnum, INamespace, IService, IType } from "protobufjs";

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

type GrpcBuiltInTypeStrings = "MESSAGE" | "ENUM" | "ONEOF" | "UNRESOLVED" | "string" | "uint32" | "int32" | "uint64" | "int64";
const GrpcBuiltInTypeSet: Set<GrpcBuiltInTypeStrings> = new Set(["MESSAGE", "ENUM", "ONEOF", "UNRESOLVED", "string", "uint32", "int32", "uint64", "int64"]);
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

class UnresolvedForwardDependencyType extends GrpcType {
	accessString: string;
	namespaces: GrpcSymbol[];
	constructor(accessString: string, namespaces: GrpcSymbol[]) {
		super("UNRESOLVED");
		this.accessString = accessString;
		this.namespaces = namespaces;
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

		rv.ResolveForwardDependencies();
		return rv;
	}

	private ResolveForwardDependencies() {
		for (let message of this.messages.values()) {
			for (let field of message.fields) {
				if (field.type instanceof UnresolvedForwardDependencyType) {
					field.type = this.ResolveForwardDependencyType(field.type);
				}
				if (field.type instanceof GrpcOneofType) {
					for (let oneofKey of Object.keys(field.type.definition)) {
						let val = field.type.definition[oneofKey];
						if (val instanceof UnresolvedForwardDependencyType) {
							field.type.definition[oneofKey] = this.ResolveForwardDependencyType(val);
						}
					}
				}
			}
		}

		for (let service of this.services.values()) {
			for (let method of service.methods) {
				if (method.inputType instanceof UnresolvedForwardDependencyType) {
					method.inputType = this.ResolveForwardDependencyType(method.inputType);
				}
				if (method.outputType instanceof UnresolvedForwardDependencyType) {
					method.outputType = this.ResolveForwardDependencyType(method.outputType);
				}
			}
		}
	}

	private ResolveForwardDependencyType(type: UnresolvedForwardDependencyType) {
		let resolvedType = this.ResolveGrpcType(type.namespaces, type.accessString);
		if (resolvedType instanceof UnresolvedForwardDependencyType) {
			throw new Error(`Cannot resolve type "${resolvedType.accessString}" from namespace "${ProtoDefinition.NamespacesToString(resolvedType.namespaces)}"`);
		}
		return resolvedType;
	}

	private static FromPbjsRecursive(namespaces: GrpcSymbol[], root: INamespace, protoDefinition: ProtoDefinition): void {
		if (root.nested != null) {
			for (let [key, val] of Object.entries(root.nested)) {
				if ("values" in val && val.values != null) { //IEnum
					protoDefinition.CreateEnumDefinition(namespaces, key, val);		
				} else if ("fields" in val && val.fields != null) { // IType
					protoDefinition.CreateMessageDefinition(namespaces, key, val);
				} else if ("methods" in val && val.methods != null) { //IService
					protoDefinition.CreateServiceDefinition(namespaces, key, val);
				} else if ("nested" in val && val.nested != null) { //INamespace
					this.FromPbjsRecursive(namespaces.concat([new GrpcSymbol(key, SymbolType.Namespace)]), val, protoDefinition);
				} 
			}
		}
	}

	private CreateEnumDefinition(namespaces: GrpcSymbol[], name: string, _enum: IEnum) {
		let enumDefinition = new EnumDefinition(
			new NamespacedSymbol(namespaces, new GrpcSymbol(name, SymbolType.Enum)),
			[]
		);
		for (let [enumKey, enumValue] of Object.entries(_enum.values)) {
			enumDefinition.values.push(
				new EnumValue(new GrpcSymbol(enumKey, SymbolType.EnumValue), enumValue)
			);
		}
		this.enums.set(ProtoDefinition.NamespacesToString(namespaces) + "." + name, enumDefinition);
	}

	private CreateServiceDefinition(namespaces: GrpcSymbol[], name: string, service: IService) {
		let serviceDefinition = new ServiceDefinition(new NamespacedSymbol(namespaces, new GrpcSymbol(name, SymbolType.Service)), []);
		for (let [methodName, method] of Object.entries(service.methods)) {
			serviceDefinition.methods.push(
				new ServiceMethod(
					new GrpcSymbol(methodName, SymbolType.Procedure), 
					this.ResolveGrpcType(namespaces, method.requestType),
					this.ResolveGrpcType(namespaces, method.responseType)
				)
			);
		}
		this.services.set(ProtoDefinition.NamespacesToString(namespaces) + "." + name, serviceDefinition);

	}

	private CreateMessageDefinition(namespaces: GrpcSymbol[], name: string, type: IType) {
		let messageDefinition = new MessageDefinition(
			new NamespacedSymbol(namespaces, new GrpcSymbol(name, SymbolType.Message)),
			[]
		);
		
		let fieldMap: Map<string, MessageField> = new Map();
		for (let [mKey, mVal] of Object.entries(type.fields)) {
			fieldMap.set(mKey, new MessageField(
				new GrpcSymbol(mKey, SymbolType.Field), 
				this.ResolveGrpcType(namespaces, mVal.type)
			));
		}

		if (type.oneofs != null) {
			for (let [oneOfKey, oneOf] of Object.entries(type.oneofs)) {
				let oneOfDefinition: Record<string, GrpcType> = {};
				for (let oneOfIndex of oneOf.oneof) {
					let MessageField = fieldMap.get(oneOfIndex);
					if (MessageField == null) {
						throw new Error("Expected field to be in message");
					}
					oneOfDefinition[oneOfIndex] = MessageField.type;
					fieldMap.delete(oneOfIndex);
				}
				fieldMap.set(oneOfKey, new MessageField(new GrpcSymbol(oneOfKey, SymbolType.Field), new GrpcOneofType(oneOfDefinition)));
			}
		}
		
		for (let field of fieldMap.values()) {
			messageDefinition.fields.push(field);
		}

		messageDefinition.fields.sort((a,b) => a.symbol.name.localeCompare(b.symbol.name));

		this.messages.set(ProtoDefinition.NamespacesToString(namespaces) + "." + name, messageDefinition);
	}

	private ResolveGrpcType(namespaceScope: GrpcSymbol[], accessString: string): GrpcType {
		if (GrpcBuiltInTypeSet.has(accessString as GrpcBuiltInTypeStrings)) {
			return new GrpcType(accessString as GrpcBuiltInTypeStrings);
		}

		let message: MessageDefinition | undefined;
		let _enum: EnumDefinition | undefined;

		let currentNamespaceStack = namespaceScope.slice();
		while (currentNamespaceStack.length > 0) {
			let fullName = ProtoDefinition.NamespacesToString(currentNamespaceStack) + "." + accessString;
			if (message = this.messages.get(fullName))
				return new GrpcMessageType(message.symbol);

			if (_enum = this.enums.get(fullName))
				return new GrpcEnumType(_enum.symbol);
				currentNamespaceStack.splice(currentNamespaceStack.length-1);
		}
		if (message = this.messages.get(accessString))
			return new GrpcMessageType(message.symbol);
		
		if (_enum = this.enums.get(accessString))
			return new GrpcEnumType(_enum.symbol);
		
		return new UnresolvedForwardDependencyType(accessString, namespaceScope);
	}

	private static NamespacesToString(namespaces: GrpcSymbol[]): string {
		return namespaces.map(x => x.name).join(".")
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
