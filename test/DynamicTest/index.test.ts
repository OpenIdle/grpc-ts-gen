import { TSCodeWriter } from "../../src/TSCodeWriter";
import { TypeGenerator } from "../../src/TypeGenerator";
import { MockNamingTransformer } from "../helper";
import * as ts from "typescript";
import { assert } from "chai";
import { join } from "path";

describe("DynamicTest", () => {
	before(async () => {
		const codeWriter = new TypeGenerator(new TSCodeWriter(new MockNamingTransformer(), false, "DynamicTest", "./../src"));
		const vd = await codeWriter.Create("test/data/dynamicsample/");
		await vd.WriteVirtualDirectory("dynamic-test/");
		const filenames = Array.from(vd.GetFlatEntries().keys());
		
		//compile the generated code using the typescript compiler and put the output into dist/dynamic-sample
		const program = ts.createProgram(filenames.map(x => join("dynamic-test", x)), {
			outDir: "dist",
		});
		const emitResult = program.emit();
		
		const allDiagnostic = ts
			.getPreEmitDiagnostics(program)
			.concat(emitResult.diagnostics);
		
		console.log(allDiagnostic);
	});
	it("Should work", () => {
		
	});
});
