import { EnumDefinition, EnumValue, GrpcSymbol, NamespacedSymbol, SymbolType } from "../../src/GRPCDefinitionTranslator";
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
		const data = await loadFromPbjsDefinition("enumsamples/SimpleEnum.proto");
		const enums = Array.from(data.GetEnums());
		assert.equal(enums.length, 1);
		assert.deepEqual(enums[0], ExpectedStatusData);
	});

	it("Should convert holey enums correctly", async () => {
		const data = await loadFromPbjsDefinition("enumsamples/HoleyEnum.proto");
		
		const enums = Array.from(data.GetEnums());
		assert.equal(enums.length, 1);
		assert.deepEqual(enums[0], ExpectedHoleyStatusData);
	});

	it("Should convert multiple enums correctly", async () => {
		const data = await loadFromPbjsDefinition([
			"enumsamples/HoleyEnum.proto", 
			"enumsamples/SimpleEnum.proto"
		]);
		
		const enums = Array.from(data.GetEnums());
		assert.equal(enums.length, 2);

		const enumNames: Set<string> = new Set();
		
		for (const _enum of enums) {
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
	});

	it("Should be able to find an enum via FindEnum", async () => {
		const data = await loadFromPbjsDefinition([
			"enumsamples/HoleyEnum.proto", 
			"enumsamples/SimpleEnum.proto"
		]);
		assert.deepEqual(
			data.FindEnum(NamespacedSymbol.FromString("test.data.enumsamples.HoleyStatus", 
				SymbolType.Enum
			)),
			ExpectedHoleyStatusData
		);
	});
});
