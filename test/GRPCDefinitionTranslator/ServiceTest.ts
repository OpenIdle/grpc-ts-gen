import { GrpcMessageType, GrpcSymbol, NamespacedSymbol, ProtoDefinition, ServiceDefinition, ServiceMethod, SymbolType } from "../../src/GRPCDefinitionTranslator";
import * as  protoLoader from "@grpc/proto-loader";
import { assert } from "chai";

const ExpectedSimpleService = new ServiceDefinition(
    NamespacedSymbol.FromString("test.data.servicesamples.SimpleService", SymbolType.Service),
    [
        new ServiceMethod(
            new GrpcSymbol("method1", SymbolType.Procedure), 
            new GrpcMessageType(
                NamespacedSymbol.FromString("test.data.servicesamples.SimpleRequest", SymbolType.Message)
            ),
            new GrpcMessageType(
                NamespacedSymbol.FromString("test.data.servicesamples.SimpleResponse", SymbolType.Message)
            ),
        ),
        new ServiceMethod(
            new GrpcSymbol("method2", SymbolType.Procedure), 
            new GrpcMessageType(
                NamespacedSymbol.FromString("test.data.servicesamples.SimpleRequest", SymbolType.Message)
            ),
            new GrpcMessageType(
                NamespacedSymbol.FromString("test.data.servicesamples.SimpleRequest", SymbolType.Message)
            ),
        )
    ]
);

describe("GRPCDefintionTranslator service test", () => {
    it("Simple case should be translated correctly", async () => {
        let data = ProtoDefinition.FromPackageDefinition(await protoLoader.load("test/data/servicesamples/SimpleService.proto"));
		assert.equal(data.enums.length, 0, "There should be no enums");
		assert.equal(data.messages.length, 2, "There should be two messages");
		assert.equal(data.services.length, 1, "There should be only one service");
		assert.deepEqual(data.services[0], ExpectedSimpleService);
    })
});
