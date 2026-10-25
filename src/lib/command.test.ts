import { expect, test } from "bun:test";
import { booleanFlag, textFlag } from "./command.ts";

test("flags are found by CLI name or camelCase key", () => {
	const flags = { businessAccountId: "acc-1", dailyNotifications: "false", plain: "x" };
	expect(textFlag(flags, "business-account-id")).toBe("acc-1");
	expect(textFlag(flags, "plain")).toBe("x");
	expect(booleanFlag(flags, "daily-notifications", true)).toBe(false);
	expect(textFlag(flags, "missing")).toBeUndefined();
});
