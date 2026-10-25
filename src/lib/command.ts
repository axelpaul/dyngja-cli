import { die, isJsonMode, printJson } from "./output.ts";
import type { CommandFlags, JsonObject } from "./types.ts";

/** Look up a flag by its CLI name (`business-account-id`) or camelCase key (`businessAccountId`). */
function flagEntry(flags: object, name: string): unknown {
	const record = flags as Record<string, unknown>;
	if (record[name] !== undefined) return record[name];
	return record[name.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase())];
}

export function textFlag(flags: object, name: string): string | undefined {
	const value = flagEntry(flags, name);
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function booleanFlag(flags: object, name: string, json: boolean): boolean | undefined {
	const value = flagEntry(flags, name);
	if (value === undefined) return undefined;
	if (typeof value === "boolean") return value;
	if (typeof value !== "string") die(`--${name} must be true or false.`, 64, json);
	const normalized = value.toLowerCase();
	if (["true", "1", "yes", "on"].includes(normalized)) return true;
	if (["false", "0", "no", "off"].includes(normalized)) return false;
	die(`--${name} must be true or false.`, 64, json);
}

export function positiveNumber(value: string | undefined, name: string, json: boolean): number {
	if (value === undefined || value.trim() === "") die(`Provide --${name}.`, 64, json);
	const number = Number(value);
	if (!Number.isFinite(number) || number <= 0)
		die(`--${name} must be a positive number.`, 64, json);
	return number;
}

export function integerValue(value: string | undefined, name: string, json: boolean): number {
	if (value === undefined || value.trim() === "") die(`Provide --${name}.`, 64, json);
	const number = Number(value);
	if (!Number.isInteger(number)) die(`--${name} must be an integer.`, 64, json);
	return number;
}

export function scalarValue(value: string): string | number {
	const number = Number(value);
	return value.trim() !== "" && Number.isFinite(number) ? number : value;
}

export function parseJson(value: string | undefined, name: string, json: boolean): unknown {
	if (value === undefined) die(`Provide --${name} as JSON.`, 64, json);
	try {
		return JSON.parse(value);
	} catch {
		die(`--${name} must contain valid JSON.`, 64, json);
	}
}

export function parseJsonObject(
	value: string | undefined,
	name: string,
	json: boolean,
): JsonObject {
	const parsed = parseJson(value, name, json);
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		die(`--${name} must contain a JSON object.`, 64, json);
	}
	return parsed as JsonObject;
}

export function requireMutationConfirmation(
	flags: CommandFlags,
	label: string,
	json: boolean,
): void {
	if (flags.dryRun || flags.yes) return;
	die(`${label} changes your Dyngja account. Add --yes to send it, or use --dry-run.`, 64, json);
}

export function printData(raw: unknown, flags: CommandFlags, normalized: unknown = raw): void {
	if (flags.raw || isJsonMode(flags)) {
		printJson(flags.raw ? raw : normalized);
		return;
	}
	if (typeof normalized === "string") {
		console.log(normalized);
		return;
	}
	console.log(JSON.stringify(normalized, null, 2));
}
