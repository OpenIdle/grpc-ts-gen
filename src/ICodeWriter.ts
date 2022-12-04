import { PackageDefinition } from "@grpc/proto-loader";
import { INamespace } from "protobufjs";
import { EnumDefinition, MessageDefinition, ServiceDefinition } from "./GRPCDefintionTranslator";
import { VirtualDirectory } from "./VirtualDirectory";

export interface ICodeWriter {
	WriteMessageInterface(message: MessageDefinition): void;
	WriteEnum(_enum: EnumDefinition): void;
	WriteServiceInterface(service: ServiceDefinition): void;
	WriteServer(services: ServiceDefinition[], packageDefinition: PackageDefinition, pbjsDefinition: INamespace): void;
	GetResult(): VirtualDirectory;
}
