import { IEnum, INamespace, IService, IType } from "protobufjs";

export enum SymbolType {
	Namespace,
	Enum,
	EnumValue,
	Service,
	Procedure,
	Field,
	Message,
	Special
}

export class GrpcSymbol {
	constructor(name: string, type: SymbolType) {
		this.name = name;
		this.type = type;
	}

	Decompose(): string[] {
		if (this.name.length == 0) {
			return [];
		}

		let allCharactersUppercase = true;
		for (const c of this.name) {
			if (c.toUpperCase() != c) {
				allCharactersUppercase = false;
				break;
			}
		}

		if (allCharactersUppercase) {
			//Screaming snake case
			return this.name.split(/(?<=[^_])_/).map(part => part.toLowerCase());
		} else {
			//either snake case, pascal case, camel case or a mix
			return this.name
				.split(/(?<=[^_])_/)
				.map((part) => {
					const splitted = [];
					let acc = "";
					for (let i = 0; i < part.length; i++) {
						const c = part.charAt(i);
						if (c.toUpperCase() == c && c != "_") {
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
		const split = fullName.split(".");
		const [name] = split.splice(split.length - 1, 1);
		return new NamespacedSymbol(
			split.map(x => new GrpcSymbol(x, SymbolType.Namespace)),
			new GrpcSymbol(name, symbolType)
		);
	}
	//this should be removed since its easy to mess up by using this when nameing transformer should be used
	Assemble(seperator?: string): string {
		if (this.namespace.length == 0) {
			return this.name.name;
		} else {
			return this.namespace.map(x => x.name).join(seperator ?? ".") + (seperator ?? ".") + this.name.name;
		}
	}

	namespace: GrpcSymbol[];
	name: GrpcSymbol;
}

type GrpcBuiltInTypeStrings = "MESSAGE" | "ENUM" | "ONEOF" | "UNRESOLVED" | "string" | "uint32" | "int32" | "uint64" | "int64";
const GrpcBuiltInTypeSet: Set<GrpcBuiltInTypeStrings> = new Set(["MESSAGE", "ENUM", "ONEOF", "UNRESOLVED", "string", "uint32", "int32", "uint64", "int64"]);
export class GrpcType {
	type: GrpcBuiltInTypeStrings;
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
	constructor(symbol: GrpcSymbol, type: GrpcType, id: number, optional?: boolean) {
		this.symbol = symbol;
		this.type = type;
		this.optional = optional ?? false;
		this.id = id;
	}
	symbol: GrpcSymbol;
	type: GrpcType;
	optional: boolean;
	id: number;
}

export class MessageDefinition {
	constructor(symbol: NamespacedSymbol, fields?: MessageField[]) {
		this.symbol = symbol;
		this.fields = fields ?? [];
		this.fields.sort((a,b) => a.id - b.id);
	}

	AddField(field: MessageField): void {
		//Binary insert
		let low = 0;
		let high = this.fields.length;
		while (low < high) {
			const mid = Math.floor((low + high) / 2);
			if (this.fields[mid].id < field.id)
				low = mid + 1;
			else
				high = mid;
		}
		this.fields.splice(low, 0, field);
	}

	GetFields(): IterableIterator<MessageField> {
		return this.fields.values();
	}
	
	symbol: NamespacedSymbol;
	private fields: MessageField[];
}

export class ServiceMethod {
	constructor(symbol: GrpcSymbol, inputType: GrpcMessageType, outputType: GrpcMessageType) {
		this.symbol = symbol;
		this.inputType = inputType;
		this.outputType = outputType;
	}
	symbol: GrpcSymbol;
	inputType: GrpcMessageType;
	outputType: GrpcMessageType;
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
		const rv = new ProtoDefinition();

		this.FromPbjsRecursive([], root, rv);

		rv.ResolveForwardDependencies();
		return rv;
	}

	private ResolveForwardDependencies(): void {
		for (const message of this.messages.values()) {
			for (const field of message.GetFields()) {
				if (field.type instanceof UnresolvedForwardDependencyType) {
					field.type = this.ResolveForwardDependencyType(field.type);
				}
				if (field.type instanceof GrpcOneofType) {
					for (const oneofKey of Object.keys(field.type.definition)) {
						const val = field.type.definition[oneofKey];
						if (val instanceof UnresolvedForwardDependencyType) {
							field.type.definition[oneofKey] = this.ResolveForwardDependencyType(val);
						}
					}
				}
			}
		}

		for (const service of this.services.values()) {
			for (const method of service.methods) {
				if (method.inputType instanceof UnresolvedForwardDependencyType) {
					method.inputType = this.ResolveForwardDependencyType(method.inputType, "MESSAGE");
				}
				if (method.outputType instanceof UnresolvedForwardDependencyType) {
					method.outputType = this.ResolveForwardDependencyType(method.outputType, "MESSAGE");
				}
			}
		}
	}

	private ResolveForwardDependencyType(type: UnresolvedForwardDependencyType): GrpcType;
	private ResolveForwardDependencyType(type: UnresolvedForwardDependencyType, expectedType: "MESSAGE"): GrpcMessageType;
	private ResolveForwardDependencyType(type: UnresolvedForwardDependencyType, expectedType?: "MESSAGE"): GrpcType {
		const resolvedType = this.ResolveGrpcType(type.namespaces, type.accessString, expectedType);
		if (resolvedType instanceof UnresolvedForwardDependencyType) {
			throw new Error(`Cannot resolve type "${resolvedType.accessString}" from namespace "${ProtoDefinition.NamespacesToString(resolvedType.namespaces)}"`);
		}
		return resolvedType;
	}

	private static FromPbjsRecursive(namespaces: GrpcSymbol[], root: INamespace, protoDefinition: ProtoDefinition): void {
		if (root.nested != null) {
			for (const [key, val] of Object.entries(root.nested)) {
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

	private CreateEnumDefinition(namespaces: GrpcSymbol[], name: string, _enum: IEnum): void {
		const enumDefinition = new EnumDefinition(
			new NamespacedSymbol(namespaces, new GrpcSymbol(name, SymbolType.Enum)),
			[]
		);
		for (const [enumKey, enumValue] of Object.entries(_enum.values)) {
			enumDefinition.values.push(
				new EnumValue(new GrpcSymbol(enumKey, SymbolType.EnumValue), enumValue)
			);
		}
		this.enums.set(enumDefinition.symbol.Assemble(), enumDefinition);
	}

	private CreateServiceDefinition(namespaces: GrpcSymbol[], name: string, service: IService): void {
		const serviceDefinition = new ServiceDefinition(new NamespacedSymbol(namespaces, new GrpcSymbol(name, SymbolType.Service)), []);
		for (const [methodName, method] of Object.entries(service.methods)) {
			serviceDefinition.methods.push(
				new ServiceMethod(
					new GrpcSymbol(methodName, SymbolType.Procedure), 
					this.ResolveGrpcType(namespaces, method.requestType),
					this.ResolveGrpcType(namespaces, method.responseType)
				)
			);
		}
		this.services.set(serviceDefinition.symbol.Assemble(), serviceDefinition);

	}

	private CreateMessageDefinition(namespaces: GrpcSymbol[], name: string, type: IType): void {
		const messageDefinition = new MessageDefinition(
			new NamespacedSymbol(namespaces, new GrpcSymbol(name, SymbolType.Message))
		);
		
		const fieldMap: Map<string, MessageField> = new Map();
		for (const [mKey, mVal] of Object.entries(type.fields)) {
			fieldMap.set(mKey, new MessageField(
				new GrpcSymbol(mKey, SymbolType.Field), 
				this.ResolveGrpcType(namespaces, mVal.type),
				mVal.id,
				mVal.options?.proto3_optional === true
			));
		}

		if (type.oneofs != null) {
			for (const [oneOfKey, oneOf] of Object.entries(type.oneofs)) {
				//Before doing anything, we have to make sure that this does not refer to a optional field
				if (oneOf.oneof.length == 1) {
					const messageField = fieldMap.get(oneOf.oneof[0]);
					if (messageField == null) {
						throw new Error("Expected field to be in message");
					}
					if (messageField.optional) {
						//This is a optional field, therefore dont make a oneof out of this
						continue;
					}
				}
				let newId = Number.MAX_SAFE_INTEGER;
				const oneOfDefinition: Record<string, GrpcType> = {};
				for (const oneOfIndex of oneOf.oneof) {
					const messageField = fieldMap.get(oneOfIndex);
					if (messageField?.optional) {
						throw new Error("Optional cannot be part of a oneof");
					}
					if (messageField == null) {
						throw new Error("Expected field to be in message");
					}
					newId = Math.min(messageField.id, newId);
					oneOfDefinition[oneOfIndex] = messageField.type;
					fieldMap.delete(oneOfIndex);
				}
				fieldMap.set(oneOfKey, new MessageField(
					new GrpcSymbol(oneOfKey, SymbolType.Field),
					new GrpcOneofType(oneOfDefinition),
					newId
				));
			}
		}
		
		for (const field of fieldMap.values()) {
			messageDefinition.AddField(field);
		}

		this.messages.set(messageDefinition.symbol.Assemble(), messageDefinition);
	}

	private ResolveGrpcType(namespaceScope: GrpcSymbol[], accessString: string): GrpcType;
	private ResolveGrpcType(namespaceScope: GrpcSymbol[], accessString: string, expectedType?: "MESSAGE"): GrpcMessageType;
	private ResolveGrpcType(namespaceScope: GrpcSymbol[], accessString: string, expectedType?: GrpcBuiltInTypeStrings): GrpcType {
		if (GrpcBuiltInTypeSet.has(accessString as GrpcBuiltInTypeStrings)) {
			return new GrpcType(accessString as GrpcBuiltInTypeStrings);
		}

		const currentNamespaceStack = namespaceScope.slice();
		while (currentNamespaceStack.length > 0) {
			const fullName = ProtoDefinition.NamespacesToString(currentNamespaceStack) + "." + accessString;
			const message = this.messages.get(fullName);
			if (message && (expectedType ?? "MESSAGE") == "MESSAGE")
				return new GrpcMessageType(message.symbol);

			const _enum = this.enums.get(fullName);
			if (_enum && (expectedType ?? "ENUM") == "ENUM")
				return new GrpcEnumType(_enum.symbol);
			
			currentNamespaceStack.splice(currentNamespaceStack.length-1);
		}

		const message = this.messages.get(accessString);
		if (message && (expectedType ?? "MESSAGE") == "MESSAGE")
			return new GrpcMessageType(message.symbol);
		
		const _enum = this.enums.get(accessString);
		if (_enum && (expectedType ?? "ENUM") == "ENUM")
			return new GrpcEnumType(_enum.symbol);
		
		return new UnresolvedForwardDependencyType(accessString, namespaceScope);
	}

	private static NamespacesToString(namespaces: GrpcSymbol[]): string {
		return namespaces.map(x => x.name).join(".");
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

	public FindMessage(symbol: NamespacedSymbol): MessageDefinition {
		const message = this.messages.get(symbol.Assemble());
		if (message == null) {
			throw new Error("Tried to look up message that does not exist");
		}
		return message;
	}

	public FindEnum(symbol: NamespacedSymbol): EnumDefinition {
		const _enum = this.enums.get(symbol.Assemble());
		if (_enum == null) {
			throw new Error("Tried to look up enum that does not exist");
		}
		return _enum;
	}

	private messages: Map<string, MessageDefinition>;
	private services: Map<string, ServiceDefinition>;
	private enums: Map<string, EnumDefinition>;
}
