import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export class VirtualDirectory {
	private entries: Map<string, string | VirtualDirectory>;
	constructor() {
		this.entries = new Map();
	}

	AddEntry(name: string, entry: string | VirtualDirectory) {
		if (this.entries.has(name)) {
			throw new Error("Tried to add already existing entry");
		}
		this.entries.set(name, entry);
	}
	
	AddDeepEntry(pathComponents: string[], entry: string | VirtualDirectory) {
		if (pathComponents.length == 0) {
			throw new Error("Needs atleast one path component");
		}
		if (pathComponents.length == 1) {
			this.AddEntry(pathComponents[0], entry);
			return;
		}

		let nextVirtualDirectory = this.entries.get(pathComponents[0]);
		if (typeof(nextVirtualDirectory) == "string") {
			throw new Error("Expected pathComponent to be a directory " + pathComponents.join("/"));
		}
		if (nextVirtualDirectory == null) {
			nextVirtualDirectory = new VirtualDirectory();
			this.AddEntry(pathComponents[0], nextVirtualDirectory);
			return;
		}
		nextVirtualDirectory.AddDeepEntry(pathComponents.slice(1), entry);
	}

	GetEntries(): IterableIterator<[string, string | VirtualDirectory]> {
		return this.entries.entries();
	}

	async WriteVirtualDirectory(outDirectory: string) {
		try {
			await mkdir(outDirectory);
		}
		catch (e) {
			if (!(e != null && typeof(e) == "object" && ("errno" in e) && (e as {"errno": number}).errno == -4075)) {
				throw e;
			}
		}
		for (const [filename, entry] of this.entries) {
			if (typeof(entry) == "string") {
				await writeFile(join(outDirectory, filename), entry);
			} else {
				entry.WriteVirtualDirectory(join(outDirectory, filename));
			}
		}
	}

	GetFlatEntries(): Map<string, string> {
		const entries: Map<string, string> = new Map();
		for (const entry of this.entries) {
			if (typeof(entry[1]) == "string") {
				entries.set(entry[0], entry[1]);
			} else {
				for (const nestedEntry of entry[1].GetFlatEntries()) {
					entries.set(entry[0] + "/" + nestedEntry[0], nestedEntry[1]);
				}
			}
		}
		return entries;
	}
}
