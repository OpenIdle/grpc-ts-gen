import { assert } from "chai";
import { describe } from "mocha";
import { EnumDefinition, EnumValue, GrpcEnumType, GrpcMessageType, GrpcOneofType, GrpcSymbol, GrpcType, MessageDefinition, MessageField, NamespacedSymbol, SymbolType } from "../../src/GRPCDefinitionTranslator";
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

const ExpectedImportedDependencies = new MessageDefinition(
	NamespacedSymbol.FromString("test.data.messagesamples2.ImportedDependencies", SymbolType.Message),
	[
		new MessageField(
			new GrpcSymbol("nestedMessage", SymbolType.Field), 
			new GrpcMessageType(NamespacedSymbol.FromString("test.data.messagesamples.SimpleMessage", SymbolType.Message))
		),
		new MessageField(
			new GrpcSymbol("oneofField", SymbolType.Field),
			new GrpcOneofType({
				"someMessage": new GrpcMessageType(NamespacedSymbol.FromString("test.data.messagesamples.SimpleMessage", SymbolType.Message))
			})
		),
		new MessageField(
			new GrpcSymbol("status", SymbolType.Field), 
			new GrpcEnumType(NamespacedSymbol.FromString("test.data.enumsamples.Status", SymbolType.Enum))
		)
	]
);

const ExpectedStatusData = new EnumDefinition(
	NamespacedSymbol.FromString("test.data.enumsamples.Status", SymbolType.Enum),
	[
		new EnumValue(new GrpcSymbol("LOGGED_IN", SymbolType.EnumValue), 0),
		new EnumValue(new GrpcSymbol("LOGGED_OUT", SymbolType.EnumValue), 1),
		new EnumValue(new GrpcSymbol("REQUIRES_PASSWORD", SymbolType.EnumValue), 2),
		new EnumValue(new GrpcSymbol("AUTHENTICATING", SymbolType.EnumValue), 3),
	]
);

const ExpectedOtherMessage = new MessageDefinition(
	NamespacedSymbol.FromString("other.namespace.OtherMessage", SymbolType.Message),
	[
		new MessageField(
			new GrpcSymbol("simpleMessage", SymbolType.Field),
			new GrpcMessageType(NamespacedSymbol.FromString("test.data.messagesamples.SimpleMessage", SymbolType.Message))
		),
		new MessageField(
			new GrpcSymbol("status", SymbolType.Field),
			new GrpcEnumType(NamespacedSymbol.FromString("test.data.enumsamples.Status", SymbolType.Enum))
		)
	]
);

describe("Importing and referencing other files and namespaces", () => {
	it("Import enum and message", async () => {
		const data = await loadFromPbjsDefinition([
			"messagesamples/SimpleMessage.proto",
			"messagesamples2/ReferingToOtherNamespace.proto",
			"enumsamples/SimpleEnum.proto",
		]);

		const messages = Array.from(data.GetMessages());
		const enums = Array.from(data.GetEnums());
		assert.equal(messages.length, 2, "Expected 2 messages");
		assert.equal(enums.length, 1, "Expected 1 enum");
		
		for (const message of messages) {
			if (message.symbol.name.name == "ImportedDependencies") {
				assert.deepEqual(message, ExpectedImportedDependencies, "ImportedDependencies is wrong");
			} else if (message.symbol.name.name == "SimpleMessage") {
				assert.deepEqual(message, ExepctedSimpleMessage, "SimpleMessage is wrong");
			} else {
				assert.fail("Unexpected message " + message.symbol.Assemble());
			}
		}

		assert.deepEqual(enums[0], ExpectedStatusData, "ExpectedStatusData is wrong");
	});

	it("Should import correctly from disjoint namespace", async () => {
		const data = await loadFromPbjsDefinition([
			"messagesamples/SimpleMessage.proto",
			"messagesamples2/ReferingToDisjointNamespace.proto",
			"enumsamples/SimpleEnum.proto"
		]);
		
		const messages = Array.from(data.GetMessages());
		const enums = Array.from(data.GetEnums());
		assert.equal(messages.length, 2, "Expected 2 messages");
		assert.equal(enums.length, 1, "Expected 1 enum");
		
		for (const message of messages) {
			if (message.symbol.name.name == "OtherMessage") {
				assert.deepEqual(message, ExpectedOtherMessage, "OtherMessage is wrong");
			} else if (message.symbol.name.name == "SimpleMessage") {
				assert.deepEqual(message, ExepctedSimpleMessage, "SimpleMessage is wrong");
			} else {
				assert.fail("Unexpected message " + message.symbol.Assemble());
			}
		}

		assert.deepEqual(enums[0], ExpectedStatusData, "ExpectedStatusData is wrong");
	});
});
