import { EnumDefinition, EnumValue, GrpcSymbol, NamespacedSymbol, ProtoDefinition } from "../../src/GRPCDefinitionTranslator";
import * as  protoLoader from "@grpc/proto-loader";
import { assert } from "chai";

const ExpectedHoleyStatusData = new EnumDefinition(
	NamespacedSymbol.FromString("test.data.enumsamples.HoleyStatus"),
	[
		new EnumValue(new GrpcSymbol("LOGGED_IN"), 0),
		new EnumValue(new GrpcSymbol("LOGGED_OUT"), 10),
		new EnumValue(new GrpcSymbol("REQUIRES_PASSWORD"), 20),
		new EnumValue(new GrpcSymbol("AUTHENTICATING"), 35),
	]
);

const ExpectedStatusData = new EnumDefinition(
	NamespacedSymbol.FromString("test.data.enumsamples.Status"),
	[
		new EnumValue(new GrpcSymbol("LOGGED_IN"), 0),
		new EnumValue(new GrpcSymbol("LOGGED_OUT"), 1),
		new EnumValue(new GrpcSymbol("REQUIRES_PASSWORD"), 2),
		new EnumValue(new GrpcSymbol("AUTHENTICATING"), 3),
	]
);

describe("GRPCDefintionTranslator enums test", () => {
	it("Should convert enums correctly", async () => {
		let data = ProtoDefinition.FromPackageDefinition(await protoLoader.load("test/data/enumsamples/SimpleEnum.proto"));
		
		assert.equal(data.enums.length, 1);
		assert.equal(data.messages.length, 0);
		assert.equal(data.services.length, 0);
		assert.deepEqual(data.enums[0], ExpectedStatusData);
	})

	it("Should convert holey enums correctly", async () => {
		let data = ProtoDefinition.FromPackageDefinition(await protoLoader.load("test/data/enumsamples/HoleyEnum.proto"));
		
		assert.equal(data.enums.length, 1);
		assert.equal(data.messages.length, 0);
		assert.equal(data.services.length, 0);
		assert.deepEqual(data.enums[0], ExpectedHoleyStatusData);
	})

	it("Should convert multiple enums correctly", async () => {
		let data = ProtoDefinition.FromPackageDefinition(await protoLoader.load([
			"test/data/enumsamples/HoleyEnum.proto", 
			"test/data/enumsamples/SimpleEnum.proto"
		]));
		
		assert.equal(data.enums.length, 2);
		assert.equal(data.messages.length, 0);
		assert.equal(data.services.length, 0);
		let enumNames: Set<string> = new Set();
		
		for (let _enum of data.enums) {
			assert.oneOf(_enum.symbol.name.name, [
				ExpectedHoleyStatusData.symbol.name.name,
				ExpectedStatusData.symbol.name.name
			]);
			if (_enum.symbol.name.name ==  ExpectedHoleyStatusData.symbol.name.name) {
				assert.deepEqual(_enum, ExpectedHoleyStatusData);
			} else if (_enum.symbol.name.name == ExpectedStatusData.symbol.name.name) {
				assert.deepEqual(_enum, ExpectedStatusData);
			}
			enumNames.add(_enum.symbol.name.name);
		}

		assert.equal(enumNames.size, 2);
	})
});