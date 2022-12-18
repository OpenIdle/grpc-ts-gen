import { status } from "@grpc/grpc-js";

export class GrpcResponseError extends Error {
	grpcErrorCode: status;
	constructor(message: string, grpcErrorCode: status) {
		super(message);
		this.name = "GrpcResponseError";
		this.grpcErrorCode = grpcErrorCode;
	}
}
