import { GrpcMessageType, GrpcSymbol, NamespacedSymbol, ProtoDefinition, ServiceDefinition, ServiceMethod, SymbolType } from "../../src/GRPCDefinitionTranslator";
import * as  protoLoader from "@grpc/proto-loader";
import { assert } from "chai";
import { loadFromPbjsDefinition } from "../helper";


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
        ),
        new ServiceMethod(
            new GrpcSymbol("method3", SymbolType.Procedure), 
            new GrpcMessageType(
                NamespacedSymbol.FromString("test.data.servicesamples.SimpleRequest", SymbolType.Message)
            ),
            new GrpcMessageType(
                NamespacedSymbol.FromString("test.data.servicesamples.SimpleResponse", SymbolType.Message)
            ),
        ),
        new ServiceMethod(
            new GrpcSymbol("method4", SymbolType.Procedure), 
            new GrpcMessageType(
                NamespacedSymbol.FromString("test.data.servicesamples.SimpleRequest", SymbolType.Message)
            ),
            new GrpcMessageType(
                NamespacedSymbol.FromString("test.data.servicesamples.SimpleResponse", SymbolType.Message)
            ),
        ),
        new ServiceMethod(
            new GrpcSymbol("method5", SymbolType.Procedure), 
            new GrpcMessageType(
                NamespacedSymbol.FromString("test.data.servicesamples.SimpleRequest", SymbolType.Message)
            ),
            new GrpcMessageType(
                NamespacedSymbol.FromString("test.data.servicesamples.SimpleResponse", SymbolType.Message)
            ),
        ),
    ]
);

describe("GRPCDefintionTranslator service test", () => {
    it("Simple case should be translated correctly", async () => {
        let data = await loadFromPbjsDefinition("servicesamples/SimpleService.proto");
        
        let services = Array.from(data.GetServices());
        assert.equal(services.length, 1);

        assert.deepEqual(services[0], ExpectedSimpleService);
    })

    it("Simple case with forward dependencies should be translated correctly", async () => {
        let data = await loadFromPbjsDefinition("servicesamples/ForwardDependency.proto");
        
        let services = Array.from(data.GetServices());
        assert.equal(services.length, 1);

        assert.deepEqual(services[0], ExpectedSimpleService);
    })
});
