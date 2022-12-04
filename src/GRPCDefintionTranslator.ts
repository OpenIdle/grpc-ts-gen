import { PackageDefinition } from "@grpc/proto-loader";

export class GrpcSymbol {
	constructor(name: string) {
		this.name = name;
	}
	name: string;
}

export class NamespacedSymbol {
	constructor(namespace: GrpcSymbol[], name: GrpcSymbol) {
		this.namespace = namespace;
		this.name = name;
	}

	static FromString(fullName: string): NamespacedSymbol {
		let split = fullName.split(".");
		let [name] = split.splice(split.length - 1, 1);
		return new NamespacedSymbol(
			split.map(x => new GrpcSymbol(x)),
			new GrpcSymbol(name)
		);
	}

	namespace: GrpcSymbol[];
	name: GrpcSymbol;
}

type GrpcBuiltInTypeStrings = "TYPE_MESSAGE" | "TYPE_ENUM" | "TYPE_STRING" | "TYPE_INT64" | "TYPE_INT32" | "TYPE_UINT32";

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

	static FromPackageDefinition(packageDefinition: PackageDefinition): ProtoDefinition {
		let rv = new ProtoDefinition([], [], []);
		for (let [key, proto] of Object.entries(packageDefinition)) {
			if ("format" in proto && proto.format == 'Protocol Buffer 3 DescriptorProto') {
				let symbol = NamespacedSymbol.FromString(key);
				let fields: MessageField[] = [];
				for (let field of ((proto.type as any).field as any[])) {
					let type: GrpcType;
					if (field.type == "TYPE_ENUM") {
						type = new GrpcEnumType(NamespacedSymbol.FromString(field.typeName))
					} else if (field.type == "TYPE_MESSAGE") {
						type = new GrpcMessageType(NamespacedSymbol.FromString(field.typeName))
					} else {
						type = new GrpcType(field.type);
					}
					fields.push(new MessageField(
						new GrpcSymbol(field.name),
						type
					));
				}
				rv.messages.push(new MessageDefinition(symbol, fields));
			} else if ("format" in proto && proto.format == 'Protocol Buffer 3 EnumDescriptorProto') {
				let symbol = NamespacedSymbol.FromString(key);
				let values: EnumValue[] = [];
				for (let value of (proto.type as any).value) {
					values.push(new EnumValue(new GrpcSymbol(value.name), value.number));
				}
				rv.enums.push(new EnumDefinition(symbol, values));
			} else {
				let symbol = NamespacedSymbol.FromString(key);
				let methods: ServiceMethod[] = [];
	
				for (let [key, procedure] of Object.entries(proto)) {
					let method_symbol = new GrpcSymbol(key);
					let requestName = (procedure.requestType.type as any).name;
					let responseName = (procedure.responseType.type as any).name;
					
					let inputType = new GrpcMessageType(new NamespacedSymbol(symbol.namespace, new GrpcSymbol(requestName)));
					let outputType = new GrpcMessageType(new NamespacedSymbol(symbol.namespace, new GrpcSymbol(responseName)));
					
					methods.push(new ServiceMethod(method_symbol, inputType, outputType));
				}
	
				rv.services.push(new ServiceDefinition(symbol, methods));
			}
		}
		return rv;
	}
	messages: MessageDefinition[];
	services: ServiceDefinition[];
	enums: EnumDefinition[];
}