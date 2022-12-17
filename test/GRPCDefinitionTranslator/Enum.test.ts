import { EnumDefinition, EnumValue, GrpcSymbol, NamespacedSymbol, ProtoDefinition, SymbolType } from "../../src/GRPCDefinitionTranslator";
import * as  protoLoader from "@grpc/proto-loader";
import { assert } from "chai";
import { loadFromPbjsDefinition } from "../helper";

const ExpectedHoleyStatusData = new EnumDefinition(
	NamespacedSymbol.FromString("test.data.enumsamples.HoleyStatus", SymbolType.Enum),
	[
		new EnumValue(new GrpcSymbol("LOGGED_IN", SymbolType.EnumValue), 0),
		new EnumValue(new GrpcSymbol("LOGGED_OUT", SymbolType.EnumValue), 10),
		new EnumValue(new GrpcSymbol("REQUIRES_PASSWORD", SymbolType.EnumValue), 20),
		new EnumValue(new GrpcSymbol("AUTHENTICATING", SymbolType.EnumValue), 35),
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

describe("GRPCDefintionTranslator enums test", () => {
	it("Should convert enums correctly", async () => {
		let data = await loadFromPbjsDefinition("enumsamples/SimpleEnum.proto");
		let enums = Array.from(data.GetEnums());
		assert.equal(enums.length, 1);
		assert.deepEqual(enums[0], ExpectedStatusData);
	})

	it("Should convert holey enums correctly", async () => {
		let data = await loadFromPbjsDefinition("enumsamples/HoleyEnum.proto");
		
		let enums = Array.from(data.GetEnums());
		assert.equal(enums.length, 1);
		assert.deepEqual(enums[0], ExpectedHoleyStatusData);
	})

	it("Should convert multiple enums correctly", async () => {
		let data = await loadFromPbjsDefinition([
			"enumsamples/HoleyEnum.proto", 
			"enumsamples/SimpleEnum.proto"
		]);
		
		let enums = Array.from(data.GetEnums());
		assert.equal(enums.length, 2);

		let enumNames: Set<string> = new Set();
		
		for (let _enum of enums) {
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