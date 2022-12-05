import * as  protoLoader from "@grpc/proto-loader";
import { assert, expect } from "chai";
import { GrpcEnumType, GrpcMessageType, GrpcSymbol, GrpcType, MessageDefinition, MessageField, NamespacedSymbol, ProtoDefinition } from "../../src/GRPCDefinitionTranslator";

const ExepctedSimpleMessage = new MessageDefinition(
	NamespacedSymbol.FromString("test.data.messagesamples.SimpleMessage"),
	[
		new MessageField(new GrpcSymbol("username"), new GrpcType("TYPE_STRING")),
		new MessageField(new GrpcSymbol("someNumber"), new GrpcType("TYPE_UINT32")),
		new MessageField(new GrpcSymbol("signedNumber"), new GrpcType("TYPE_INT32")),
		new MessageField(new GrpcSymbol("anotherString"), new GrpcType("TYPE_STRING")),
	]
);

const ExpectedAdvancedMessage = new MessageDefinition(
	NamespacedSymbol.FromString("test.data.messagesamples.AdvancedMessage"),
	[
		new MessageField(new GrpcSymbol("username"), new GrpcType("TYPE_STRING")),
		new MessageField(new GrpcSymbol("someNumber"), new GrpcType("TYPE_UINT32")),
		new MessageField(new GrpcSymbol("signedNumber"), new GrpcType("TYPE_INT32")),
		new MessageField(new GrpcSymbol("anotherString"), new GrpcType("TYPE_STRING")),
		new MessageField(new GrpcSymbol("status"), new GrpcEnumType(
			NamespacedSymbol.FromString("test.data.messagesamples.Status"))
		),
		new MessageField(new GrpcSymbol("nestedMessage"), new GrpcMessageType(
			NamespacedSymbol.FromString("test.data.messagesamples.SimpleMessage"))
		),
	]
)

describe("GRPCDefintionTranslator message test", () => {
	it("Should convert message with only built in types correctly", async () => {
		let data = ProtoDefinition.FromPackageDefinition(await protoLoader.load("test/data/messagesamples/SimpleMessage.proto"));
		
		assert.equal(data.enums.length, 0);
		assert.equal(data.messages.length, 1);
		assert.equal(data.services.length, 0);
		assert.deepEqual(data.messages[0], ExepctedSimpleMessage);
	});

	it("Should convet message with nested message fields and enums correctly", async () => {
		let data = ProtoDefinition.FromPackageDefinition(await protoLoader.load("test/data/messagesamples/MessageWithCustomTypes.proto"));
		
		assert.equal(data.enums.length, 1);
		assert.equal(data.messages.length, 2);
		assert.equal(data.services.length, 0);
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