import { assert } from "chai";
import { Program } from "../src/Program";

it("Should be able to run the cli on a simple sample", async () => {
	const result = await Program.Main(["npx", "grpc-ts-gen", "--proto-base-path", "test/data/dynamicsample", "--out-path", "smoke-out", "--request-body-as-object"]);
	assert.equal(result, 0, "CLI should exit with code 0");
});
