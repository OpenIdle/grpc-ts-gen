import { assert } from "chai";
import { describe } from "mocha";
import { loadFromPbjsDefinition } from "../helper";

describe("Importing and referencing other files and namespaces", () => {
	it.skip("Import enum and message", async () => {
		const data = await loadFromPbjsDefinition([
			"messagesamples/SimpleMessage.proto",
			"messagesamples2/ReferingToOtherNamespace.proto",
			"enumsamples/SimpleEnum.proto",
		]);

		const messages = Array.from(data.GetMessages());
		const enums = Array.from(data.GetEnums());
		assert.equal(messages.length, 2, "Expected 2 messages");
		assert.equal(enums.length, 1, "Expected 1 enum");
	});
});
