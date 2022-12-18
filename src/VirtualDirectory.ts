import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export interface VirtualDirectory {
	entries: Map<string, string | VirtualDirectory>;
}

export async function WriteVirtualDirectory(vd: VirtualDirectory, outDirectory: string) {
	try {
		await mkdir(outDirectory);
	}
	catch (e) {
		if (!(e != null && typeof(e) == "object" && ("errno" in e) && (e as {"errno": number}).errno == -4075)) {
			throw e;
		}
	}
	for (const [filename, entry] of vd.entries) {
		if (typeof(entry) == "string") {
			await writeFile(join(outDirectory, filename), entry);
		} else {
			WriteVirtualDirectory(entry, join(outDirectory, filename));
		}
	}
}
