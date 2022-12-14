import { assert } from "chai";
import { readFile, stat } from "fs/promises";
import { VirtualDirectory } from "../src/VirtualDirectory";

describe("VirtualDirectory test", () => {
	it("Should add files correctly", () => {
		const vd = new VirtualDirectory();
		vd.AddEntry("file.ts", "hello");
		const entryMap = vd.GetEntryMap();
		assert.equal(entryMap.size, 1, "Should only have 1 entry");
		assert.equal(entryMap.get("file.ts"), "hello", "Should contain hello in entryMap");
		assert.deepEqual(Array.from(vd.GetEntries()), [["file.ts", "hello"]], "Should contain hello in entriesIterator");
	});

	it("Should add sub directories correctly", () => {
		const vd = new VirtualDirectory();
		const subVd = new VirtualDirectory();
		vd.AddEntry("directory", subVd);
		const entryMap = vd.GetEntryMap();
		assert.equal(entryMap.size, 1, "Should only have 1 entry");
		assert.equal(entryMap.get("directory"), subVd, "Should contain directory in entryMap");
		assert.deepEqual(Array.from(vd.GetEntries()), [["directory", subVd]], "Should contain directory in entriesIterator");
	});

	it("Should add either file or sub directory correctly", () => {
		const vd = new VirtualDirectory();
		const subVd = new VirtualDirectory();
		vd.AddEntry("directory", subVd);
		vd.AddEntry("file.ts", "hello");
		const entryMap = vd.GetEntryMap();
		assert.equal(entryMap.size, 2, "Should only have 2 entries");
		assert.equal(entryMap.get("directory"), subVd, "Should contain directory in entryMap");
		assert.equal(entryMap.get("file.ts"), "hello", "Should contain directory in entryMap");
	});

	it("Should work correctly with add deep entry", () => {
		const vd = new VirtualDirectory();
		vd.AddDeepEntry(["foo", "bar.ab"], "hello1");
		vd.AddDeepEntry(["foo", "baz.cd"], "hello2");
		vd.AddDeepEntry(["qux", "bar.ab"], "hello3");
		
		const entryMap = vd.GetEntryMap();
		assert.equal(entryMap.size, 2, "Should have 2 entries");
		
		const equivalentFooVd = new VirtualDirectory();
		equivalentFooVd.AddEntry("bar.ab", "hello1");
		equivalentFooVd.AddEntry("baz.cd", "hello2");

		const equivalentQuxVd = new VirtualDirectory();
		equivalentQuxVd.AddEntry("bar.ab", "hello3");

		assert.deepEqual(entryMap.get("foo"), equivalentFooVd, "foo should contain bar.ab and baz.cd");
		assert.deepEqual(entryMap.get("qux"), equivalentQuxVd, "foo should contain bar.ts");
	});

	it("Should work with flat entries", () => {
		const vd = new VirtualDirectory();
		vd.AddDeepEntry(["foo", "bar.ab"], "hello1");
		vd.AddDeepEntry(["foo", "baz.cd"], "hello2");
		vd.AddDeepEntry(["qux", "bar.ab"], "hello3");
		
		const flatEntries = vd.GetFlatEntries();
		assert.equal(flatEntries.size, 3, "Should have 3 entries");

		assert.deepEqual(flatEntries.get("foo/bar.ab"), "hello1", "foo/bar.ab should contain hello1");
		assert.deepEqual(flatEntries.get("foo/baz.cd"), "hello2", "foo/baz.cd should contain hello2");
		assert.deepEqual(flatEntries.get("qux/bar.ab"), "hello3", "qux/bar.ab should contain hello3");
	});

	it("Should write files and directories correctly", async () => {
		const vd = new VirtualDirectory();
		vd.AddDeepEntry(["foo", "bar.ab"], "hello1");
		vd.AddDeepEntry(["foo", "baz.cd"], "hello2");
		vd.AddDeepEntry(["qux", "bar.ab"], "hello3");
		await vd.WriteVirtualDirectory("dynamic-test/vd");

		assert.isTrue((await stat("dynamic-test/vd/foo")).isDirectory());
		assert.isTrue((await stat("dynamic-test/vd/qux")).isDirectory());
		
		assert.equal((await readFile("dynamic-test/vd/foo/bar.ab")).toString(), "hello1");
		assert.equal((await readFile("dynamic-test/vd/foo/baz.cd")).toString(), "hello2");
		assert.equal((await readFile("dynamic-test/vd/qux/bar.ab")).toString(), "hello3");

		//Should be able to overwrite it without errors

		const vd2 = new VirtualDirectory();
		vd2.AddDeepEntry(["foo", "bar.ab"], "hello4");
		vd2.AddDeepEntry(["foo", "baz.cd"], "hello5");
		vd2.AddDeepEntry(["qux", "bar.ab"], "hello6");
		await vd2.WriteVirtualDirectory("dynamic-test/vd");

		assert.isTrue((await stat("dynamic-test/vd/foo")).isDirectory());
		assert.isTrue((await stat("dynamic-test/vd/qux")).isDirectory());
		
		assert.equal((await readFile("dynamic-test/vd/foo/bar.ab")).toString(), "hello4");
		assert.equal((await readFile("dynamic-test/vd/foo/baz.cd")).toString(), "hello5");
		assert.equal((await readFile("dynamic-test/vd/qux/bar.ab")).toString(), "hello6");
	});
});
