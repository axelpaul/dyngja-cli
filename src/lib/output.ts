import type { OutputFlags } from "./types.ts";

export function isJsonMode(flags: OutputFlags): boolean {
	if (flags.json) return true;
	if (flags.pretty) return false;
	return !process.stdout.isTTY;
}

export function printJson(value: unknown): void {
	console.log(JSON.stringify(value, null, 2));
}

const supportsColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;

function colorize(code: number, value: string): string {
	return supportsColor ? `\x1b[${code}m${value}\x1b[0m` : value;
}

export const color = {
	bold: (value: string) => colorize(1, value),
	dim: (value: string) => colorize(2, value),
	green: (value: string) => colorize(32, value),
	yellow: (value: string) => colorize(33, value),
	red: (value: string) => colorize(31, value),
};

export function die(message: string, code = 1, json = false): never {
	if (json) console.error(JSON.stringify({ error: message }));
	else console.error(color.red(`Error: ${message}`));
	process.exit(code);
}

export type AuthFailReason = "not_logged_in" | "rejected";

const authMessages: Record<AuthFailReason, string> = {
	not_logged_in: 'Not logged in. Run "dyngja login".',
	rejected: 'Dyngja rejected the session. Run "dyngja login" again.',
};

export function dieAuth(reason: AuthFailReason, json = false): never {
	const message = authMessages[reason];
	if (json) console.error(JSON.stringify({ error: message, code: `auth_${reason}` }));
	else console.error(color.yellow(message));
	process.exit(2);
}
