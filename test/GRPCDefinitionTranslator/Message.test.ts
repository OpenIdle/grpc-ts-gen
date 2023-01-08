import { assert } from "chai";
import { GrpcEnumType, GrpcMessageType, GrpcOneofType, GrpcSymbol, GrpcType, MessageDefinition, MessageField, NamespacedSymbol, SymbolType } from "../../src/GRPCDefinitionTranslator";
import { loadFromPbjsDefinition } from "../helper";

const ExepctedSimpleMessage = new MessageDefinition(
	NamespacedSymbol.FromString("test.data.messagesamples.SimpleMessage", SymbolType.Message),
	[
		new MessageField(new GrpcSymbol("anotherString", SymbolType.Field), new GrpcType("string")),
		new MessageField(new GrpcSymbol("signedNumber", SymbolType.Field), new GrpcType("int32")),
		new MessageField(new GrpcSymbol("someNumber", SymbolType.Field), new GrpcType("uint32")),
		new MessageField(new GrpcSymbol("username", SymbolType.Field), new GrpcType("string")),
	]
);

const ExpectedAdvancedMessage = new MessageDefinition(
	NamespacedSymbol.FromString("test.data.messagesamples.AdvancedMessage", SymbolType.Message),
	[
		new MessageField(new GrpcSymbol("anotherString", SymbolType.Field), new GrpcType("string")),
		new MessageField(new GrpcSymbol("nestedMessage", SymbolType.Field), new GrpcMessageType(
			NamespacedSymbol.FromString("test.data.messagesamples.SimpleMessage", SymbolType.Message))
		),
		new MessageField(new GrpcSymbol("signedNumber", SymbolType.Field), new GrpcType("int32")),
		new MessageField(new GrpcSymbol("someNumber", SymbolType.Field), new GrpcType("uint32")),
		new MessageField(new GrpcSymbol("status", SymbolType.Field), new GrpcEnumType(
			NamespacedSymbol.FromString("test.data.messagesamples.Status", SymbolType.Enum))
		),
		new MessageField(new GrpcSymbol("username", SymbolType.Field), new GrpcType("string")),
	]
);

const ExpectedOneofMessage = new MessageDefinition(
	NamespacedSymbol.FromString("test.data.messagesamples.OneofContainer", SymbolType.Message),
	[
		new MessageField(new GrpcSymbol("oneofField", SymbolType.Field), new GrpcOneofType({
			someMessage: new GrpcMessageType(NamespacedSymbol.FromString("test.data.messagesamples.SomeMessage", SymbolType.Message)),
			str: new GrpcType("string"),
			i: new GrpcType("int32"),
		})),
		new MessageField(new GrpcSymbol("someOtherField", SymbolType.Field), new GrpcType("string")),
		new MessageField(new GrpcSymbol("someOtherField2", SymbolType.Field), new GrpcType("string"))
	]
);

const ExpectedOptionalMessage = new MessageDefinition(
	NamespacedSymbol.FromString("test.data.messagesamples.OptionalContainer", SymbolType.Message),
	[
		new MessageField(
			new GrpcSymbol("testField", SymbolType.Field), 
			new GrpcType("string"),
			true
		),
		new MessageField(
			new GrpcSymbol("testField2", SymbolType.Field),
			new GrpcOneofType({
				option: new GrpcType("string")
			})
		)
	]
);

describe("GRPCDefintionTranslator message test", () => {
	it("Should convert message with only built in types correctly", async () => {
		const data = await loadFromPbjsDefinition("messagesamples/SimpleMessage.proto");
		
		const messages = Array.from(data.GetMessages());
		assert.equal(messages.length, 1);
		assert.deepEqual(messages[0], ExepctedSimpleMessage);
	});

	it("Should convert message with nested message fields and enums correctly", async () => {
		const data = await loadFromPbjsDefinition("messagesamples/MessageWithCustomTypes.proto");

		const messages = Array.from(data.GetMessages());
		assert.equal(messages.length, 2);

		let targetMessage;
		for (const message of messages) {
			if (message.symbol.name.name == "AdvancedMessage") {
				targetMessage = message;
			}
		}

		assert.exists(targetMessage, "Exepcted to find AdvancedMessage");
		assert.deepEqual(targetMessage, ExpectedAdvancedMessage);
	});

	it("Should convert oneof fields correctly", async () => {
		const data = await loadFromPbjsDefinition("messagesamples/OneofField.proto");
		
		const messages = Array.from(data.GetMessages());
		assert.equal(messages.length, 2);
		
		for (const message of messages) {
			if (message.symbol.name.name == "OneofContainer") {
				assert.deepEqual(message, ExpectedOneofMessage, "The message containing a oneof should be correct");
			}
		}
	});

	it("Should convert message with forward dependencies correctly", async () => {
		const data = await loadFromPbjsDefinition("messagesamples/ForwardDependency.proto");

		const messages = Array.from(data.GetMessages());
		assert.equal(messages.length, 2);

		let targetMessage;
		for (const message of messages) {
			if (message.symbol.name.name == "AdvancedMessage") {
				targetMessage = message;
			}
		}

		assert.exists(targetMessage, "Exepcted to find AdvancedMessage");
		assert.deepEqual(targetMessage, ExpectedAdvancedMessage);
	});

	it("Should convert oneof fields correctly", async () => {
		const data = await loadFromPbjsDefinition("messagesamples/OptionalField.proto");

		const message = data.FindMessage(NamespacedSymbol.FromString("test.data.messagesamples.OptionalContainer", SymbolType.Message));

		assert.deepEqual(message, ExpectedOptionalMessage);
	});
});
