#!/usr/bin/env bun

import pkg from "../package.json" with { type: "json" };
import { confirmCommand } from "./commands/confirm.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { infoCommand } from "./commands/info.ts";
import { loginCommand } from "./commands/login.ts";
import { logoutCommand } from "./commands/logout.ts";
import { registerCommand } from "./commands/register.ts";
import { resendCommand } from "./commands/resend.ts";
import { schemaCommand } from "./commands/schema.ts";
import { transactionsCommand } from "./commands/transactions.ts";
import { whoamiCommand } from "./commands/whoami.ts";
import { ApiError, AuthError } from "./lib/api.ts";
import { color, dieAuth } from "./lib/output.ts";
import type { OutputFlags } from "./lib/types.ts";

export const VERSION = pkg.version;

interface CommandSpec {
	name: string;
	description: string;
	usage?: string;
}

const commands: CommandSpec[] = [
	{
		name: "login",
		description: "Sign in and cache a session.",
		usage: "dyngja login [--email <e>] [--password <p>]",
	},
	{ name: "logout", description: "Clear the local session." },
	{ name: "whoami", description: "Show the signed-in account." },
	{ name: "info", description: "Show current app settings." },
	{
		name: "transactions",
		description: "List account activity.",
		usage: "dyngja transactions [--count N]",
	},
	{
		name: "register",
		description: "Create a Dyngja account.",
		usage: "dyngja register --email <e> [--name <name>]",
	},
	{
		name: "confirm",
		description: "Confirm an account with its email code.",
		usage: "dyngja confirm --email <e> --code <n>",
	},
	{
		name: "resend",
		description: "Send a new confirmation code.",
		usage: "dyngja resend --email <e>",
	},
	{ name: "doctor", description: "Check API reachability and session health." },
	{
		name: "schema",
		description: "Show an agent-facing response shape.",
		usage: "dyngja schema [command]",
	},
	{ name: "version", description: "Print the CLI version." },
];

function flag(name: string): string | undefined {
	const prefix = `--${name}=`;
	for (let index = 0; index < process.argv.length; index += 1) {
		const argument = process.argv[index];
		if (argument === `--${name}`) return process.argv[index + 1];
		if (argument?.startsWith(prefix)) return argument.slice(prefix.length);
	}
	return undefined;
}

function hasFlag(name: string): boolean {
	const prefix = `--${name}=`;
	return (
		process.argv.includes(`--${name}`) ||
		process.argv.some((argument) => argument.startsWith(prefix))
	);
}

const globalFlags: OutputFlags = {
	json: hasFlag("json"),
	pretty: hasFlag("pretty"),
	raw: hasFlag("raw"),
};
const positional = process.argv.slice(2).filter((argument) => !argument.startsWith("-"));
const command = positional[0];

function printHelp(): void {
	if (globalFlags.json) {
		console.log(
			JSON.stringify(
				{
					name: pkg.name,
					version: VERSION,
					commands,
					global_flags: ["--json", "--pretty", "--raw"],
				},
				null,
				2,
			),
		);
		return;
	}
	console.log(`${color.bold("dyngja")} — Dyngja from the terminal`);
	console.log("\nCommands:");
	for (const item of commands)
		console.log(`  ${color.bold(item.name.padEnd(13))} ${item.description}`);
	console.log(
		`\nGlobal: ${color.dim("--json")} (machine output), ${color.dim("--pretty")} (human output), ${color.dim("--raw")} (API response)`,
	);
}

async function main(): Promise<void> {
	if (!command || command === "help" || hasFlag("help")) {
		printHelp();
		return;
	}
	if (hasFlag("version") || command === "version") {
		if (globalFlags.json) console.log(JSON.stringify({ name: pkg.name, version: VERSION }));
		else console.log(`dyngja ${VERSION}`);
		return;
	}

	switch (command) {
		case "login":
			return loginCommand({ email: flag("email"), password: flag("password"), ...globalFlags });
		case "logout":
			return logoutCommand(globalFlags);
		case "whoami":
			return whoamiCommand(globalFlags);
		case "info":
			return infoCommand(globalFlags);
		case "transactions":
			return transactionsCommand({ count: flag("count"), ...globalFlags });
		case "register":
			return registerCommand({
				email: flag("email"),
				password: flag("password"),
				name: flag("name"),
				...globalFlags,
			});
		case "confirm":
			return confirmCommand({ email: flag("email"), code: flag("code"), ...globalFlags });
		case "resend":
			return resendCommand({ email: flag("email"), ...globalFlags });
		case "doctor":
			return doctorCommand(globalFlags);
		case "schema":
			return schemaCommand({ command: positional[1], ...globalFlags });
		default:
			console.error(color.red(`Unknown command: ${command}`));
			console.error(`Run ${color.bold("dyngja help")}.`);
			process.exit(64);
	}
}

main().catch((error: unknown) => {
	if (error instanceof AuthError) dieAuth("rejected", Boolean(globalFlags.json));
	const message = error instanceof Error ? error.message : String(error);
	if (globalFlags.json) {
		const status = error instanceof ApiError ? error.status : undefined;
		console.error(JSON.stringify({ error: message, status }));
	} else console.error(color.red(`Error: ${message}`));
	process.exit(error instanceof ApiError && error.status === 401 ? 2 : 1);
});
