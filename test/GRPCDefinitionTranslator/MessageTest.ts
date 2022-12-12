import * as  protoLoader from "@grpc/proto-loader";
import { assert, expect } from "chai";
import { GrpcEnumType, GrpcMessageType, GrpcSymbol, GrpcType, MessageDefinition, MessageField, NamespacedSymbol, ProtoDefinition, SymbolType } from "../../src/GRPCDefinitionTranslator";

const ExepctedSimpleMessage = new MessageDefinition(
	NamespacedSymbol.FromString("test.data.messagesamples.SimpleMessage", SymbolType.Message),
	[
		new MessageField(new GrpcSymbol("username", SymbolType.Field), new GrpcType("TYPE_STRING")),
		new MessageField(new GrpcSymbol("someNumber", SymbolType.Field), new GrpcType("TYPE_UINT32")),
		new MessageField(new GrpcSymbol("signedNumber", SymbolType.Field), new GrpcType("TYPE_INT32")),
		new MessageField(new GrpcSymbol("anotherString", SymbolType.Field), new GrpcType("TYPE_STRING")),
	]
);

const ExpectedAdvancedMessage = new MessageDefinition(
	NamespacedSymbol.FromString("test.data.messagesamples.AdvancedMessage", SymbolType.Message),
	[
		new MessageField(new GrpcSymbol("username", SymbolType.Field), new GrpcType("TYPE_STRING")),
		new MessageField(new GrpcSymbol("someNumber", SymbolType.Field), new GrpcType("TYPE_UINT32")),
		new MessageField(new GrpcSymbol("signedNumber", SymbolType.Field), new GrpcType("TYPE_INT32")),
		new MessageField(new GrpcSymbol("anotherString", SymbolType.Field), new GrpcType("TYPE_STRING")),
		new MessageField(new GrpcSymbol("status", SymbolType.Field), new GrpcEnumType(
			NamespacedSymbol.FromString("test.data.messagesamples.Status", SymbolType.Enum))
		),
		new MessageField(new GrpcSymbol("nestedMessage", SymbolType.Field), new GrpcMessageType(
			NamespacedSymbol.FromString("test.data.messagesamples.SimpleMessage", SymbolType.Enum))
		),
	]
)

describe("GRPCDefintionTranslator message test", () => {
	it("Should convert message with only built in types correctly", async () => {
		let data = ProtoDefinition.FromPackageDefinition(await protoLoader.load("test/data/messagesamples/SimpleMessage.proto"));
		
		assert.equal(data.enums.length, 0, "There should be no enums");
		assert.equal(data.messages.length, 1, "There should be only one message");
		assert.equal(data.services.length, 0, "There should be no services");
		assert.deepEqual(data.messages[0], ExepctedSimpleMessage);
	});

	it("Should convert message with nested message fields and enums correctly", async () => {
		let data = ProtoDefinition.FromPackageDefinition(await protoLoader.load("test/data/messagesamples/MessageWithCustomTypes.proto"));
		
		assert.equal(data.enums.length, 1, "There should be one enum");
		assert.equal(data.messages.length, 2, "There should be two messages");
		assert.equal(data.services.length, 0, "There should be no services");
		let targetMessage;
		for (let message of data.messages) {
			if (message.symbol.name.name == "AdvancedMessage") {
				targetMessage = message;
			}
		}

		assert.exists(targetMessage, "Exepcted to find AdvancedMessage");
		assert.deepEqual(targetMessage, ExpectedAdvancedMessage);
	});
})