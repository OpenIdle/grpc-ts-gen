import { INamespace } from "protobufjs";
import { EnumDefinition, MessageDefinition, ProtoDefinition, ServiceDefinition } from "./GRPCDefinitionTranslator";
import { VirtualDirectory } from "./VirtualDirectory";

export interface ICodeWriter {
	WriteMessageInterface(message: MessageDefinition): void;
	WriteEnum(_enum: EnumDefinition): void;
	WriteServiceInterface(service: ServiceDefinition, protoDefinition: ProtoDefinition): void;
	WriteServer(protoDefinition: ProtoDefinition, pbjsDefinition: INamespace): void;
	GetResult(): VirtualDirectory;
}
