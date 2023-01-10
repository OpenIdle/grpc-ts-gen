#!/usr/bin/env node

import { Program } from "./Program";

Program.Main(process.argv)
	.then((exitCode) => {
		process.exit(exitCode);
	})
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
