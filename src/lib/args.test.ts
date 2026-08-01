import { describe, expect, test } from "bun:test";
import { parseArgs } from "./args.ts";

describe("argument parser", () => {
	test("supports boolean flags, values, and equals syntax", () => {
		const parsed = parseArgs([
			"buy",
			"--stock-type",
			"MAREL",
			"--units",
			"3",
			"--rate=92.5",
			"--json",
			"--yes",
		]);

		expect(parsed.positionals).toEqual(["buy"]);
		expect(parsed.flags).toEqual({
			"stock-type": "MAREL",
			units: "3",
			rate: "92.5",
			json: true,
			yes: true,
		});
	});

	test("keeps API paths as positionals", () => {
		const parsed = parseArgs(["api", "/api/v3/transactions/", "--method", "POST"]);
		expect(parsed.positionals).toEqual(["api", "/api/v3/transactions/"]);
		expect(parsed.flags.method).toBe("POST");
	});
});
