import { status } from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

export class GrpcResponseError extends Error {
	grpcErrorCode: status;
	constructor(message: string, grpcErrorCode: status) {
		super(message);
		this.name = "GrpcResponseError";
		this.grpcErrorCode = grpcErrorCode;
	}
}

export type ProcedureCallback = (err: {code: number} | null, response?: unknown) => void

export type Implementation<T> = Record<
	string, 
	(callObject: {request: T}, callback: ProcedureCallback) => void
>


export interface IGrpcServerImplementation {
	addService<T>(service: protoLoader.ServiceDefinition, implementation: Implementation<T>): void;
}
