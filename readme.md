# grpc-ts-gen
![npm](https://img.shields.io/npm/v/grpc-ts-gen)
![npm downloads](https://img.shields.io/npm/dm/grpc-ts-gen) 
[![Coverage Status](https://coveralls.io/repos/github/OpenIdle/grpc-ts-gen/badge.svg)](https://coveralls.io/github/OpenIdle/grpc-ts-gen)

`grpc-ts-gen` is a tool for generating a typed grpc server and client from protobuf descriptors.

This means that the only thing needed for implementing a GRPC service is implementing a simple typescript interface.

Given this protobuf definition
```proto
syntax = "proto3";

package example.HelloService;

message HelloRequest {
	string hello = 1;
}

message HelloResponse {
	string world = 1;
}

service HelloService {
	rpc Hello(HelloRequest) returns (HelloResponse);
}
```

This is the only code needed to implement a server

```ts
import { ProtoServer } from "./sample-out/ProtoServer";
import { IHelloService, HelloRequest, HelloResponse } from "./sample-out/Example/HelloService"
import { GrpcResponseError } from "grpc-ts-gen";
import * as grpc from "@grpc/grpc-js";

let server = new ProtoServer(new grpc.Server());

class HelloService implements IHelloService {
	async Hello(request: HelloRequest): Promise<HelloResponse> {
		if (request.hello != "hello") {
			throw new GrpcResponseError("Expected hello", grpc.status.INVALID_ARGUMENT)
		}
		return {world: "world"};
	}
}

server.AddHelloService(new HelloService());

```


# Installation & Usage
grpc-ts-gen is tested for node 18.x.x but will probably work for earlier version. However, for now 18.x.x is the only officially supported version, this will be changed later when all features are implemented.

Install using:
```
npm install grpc-ts-gen
```
This is not just a dev dependency, since this library also contains a small helper library for the generated code.

Generate definitions using:
```
npx grpc-ts-gen --proto-base-path <root protobuf path> --out-path <output folder>
```


## Options
grpc-ts-gen has many options to customize the generated code. A table of the options can be seen here

| Name | Description | Required |
|------|-------------|----------|
| `proto-base-path` | The base path for protobuf definition files | ✔️ |
| `out-path` | The base path for the generated files | ✔️ |
| `server-name` | The name of the file where the generated server is defined | ❌ |
| `request-body-as-object` | Supply the request object as parameters as a handler instead of an object | ❌ |

These options can also be defined in a JSON file called `grpc-ts-gen.config.json`, here they are named with camelCase instead of kebab-case.
```
// grpc-ts-gen.config.json
{
	"protoBasePath": "../OpenIdle-Connect/protos",
	"outPath": "testout",
	"serverName": "OpenIdle",
	"requestBodyAsObject": true
}
```

The option source is prioritized in this way

1. CLI option
2. Config file option
3. Default value

This means that any option supplied by the command line will overwrite the config file option.

