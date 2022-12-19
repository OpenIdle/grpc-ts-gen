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
}
