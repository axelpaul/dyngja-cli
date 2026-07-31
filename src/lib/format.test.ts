import { describe, expect, test } from "bun:test";
import { dateTime, money } from "./format.ts";

describe("format", () => {
	test("formats virtual currency", () => {
		expect(money(1000000)).toBe("1,000,000 vISK");
		expect(money(null)).toBe("—");
	});

	test("formats timestamps", () => {
		expect(dateTime("2026-01-02T03:04:00Z")).toMatch(/^2026-01-02 /);
		expect(dateTime(null)).toBe("—");
	});
});
