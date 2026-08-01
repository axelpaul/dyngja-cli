#!/usr/bin/env bun

import pkg from "../package.json" with { type: "json" };
import { confirmCommand } from "./commands/confirm.ts";
import { doctorCommand } from "./commands/doctor.ts";
import {
	accountCommand,
	adsCommand,
	analyticsCommand,
	apiCommand,
	contestsCommand,
	educationCommand,
	historyCommand,
	marketCommand,
	profileCommand,
	usersCommand,
} from "./commands/features.ts";
import { infoCommand } from "./commands/info.ts";
import { loginCommand } from "./commands/login.ts";
import { logoutCommand } from "./commands/logout.ts";
import { portfolioCommand } from "./commands/portfolio.ts";
import { registerCommand } from "./commands/register.ts";
import { resendCommand } from "./commands/resend.ts";
import { schemaCommand } from "./commands/schema.ts";
import { tradeCommand } from "./commands/trade.ts";
import { transactionsCommand } from "./commands/transactions.ts";
import { whoamiCommand } from "./commands/whoami.ts";
import { ApiError, AuthError } from "./lib/api.ts";
import { flagValue, hasFlag, parseArgs } from "./lib/args.ts";
import { color, dieAuth } from "./lib/output.ts";
import type { CommandFlags } from "./lib/types.ts";

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
	{ name: "profile", description: "View or update profile and notifications." },
	{ name: "account", description: "Manage the virtual account." },
	{ name: "market", description: "Inspect market information and stocks." },
	{ name: "portfolio", description: "Show current holdings." },
	{ name: "buy|sell", description: "Place a virtual market order." },
	{ name: "transactions", description: "List account activity." },
	{ name: "history", description: "Inspect activity and performance feeds." },
	{ name: "contests", description: "List, join, leave, and manage contests." },
	{ name: "users", description: "Search, follow, and inspect other users." },
	{ name: "education", description: "Use chapters, progress, videos, and achievements." },
	{ name: "analytics", description: "Query contest and account analytics." },
	{ name: "ads", description: "Fetch current app advertisements." },
	{ name: "api", description: "Call any Dyngja API route directly." },
	{ name: "info", description: "Show current app settings." },
	{
		name: "register",
		description: "Create a Dyngja account.",
		usage: "dyngja register --email <e>",
	},
	{ name: "confirm", description: "Confirm an account with its email code." },
	{ name: "resend", description: "Send a new confirmation code." },
	{ name: "doctor", description: "Check API reachability and session health." },
	{ name: "schema", description: "Show an agent-facing response shape." },
	{ name: "version", description: "Print the CLI version." },
];

function commonFlags(parsed: ReturnType<typeof parseArgs>): CommandFlags {
	return {
		json: hasFlag(parsed, "json"),
		pretty: hasFlag(parsed, "pretty"),
		raw: hasFlag(parsed, "raw"),
		yes: hasFlag(parsed, "yes"),
		dryRun: hasFlag(parsed, "dry-run"),
	};
}

function printHelp(): void {
	const parsed = parseArgs();
	const flags = commonFlags(parsed);
	if (flags.json) {
		console.log(
			JSON.stringify(
				{
					name: pkg.name,
					version: VERSION,
					commands,
					global_flags: ["--json", "--pretty", "--raw", "--yes", "--dry-run"],
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
		console.log(`  ${color.bold(item.name.padEnd(16))} ${item.description}`);
	console.log(
		`\nGlobal: ${color.dim("--json")} (machine output), ${color.dim("--pretty")} (human output), ${color.dim("--raw")} (API response)`,
	);
	console.log(
		`        ${color.dim("--yes")} (confirm mutations), ${color.dim("--dry-run")} (show mutation without sending)`,
	);
}

async function main(): Promise<void> {
	const parsed = parseArgs();
	const command = parsed.positionals[0];
	const flags = commonFlags(parsed);
	if (!command || command === "help" || hasFlag(parsed, "help")) {
		printHelp();
		return;
	}
	if (hasFlag(parsed, "version") || command === "version") {
		if (flags.json) console.log(JSON.stringify({ name: pkg.name, version: VERSION }));
		else console.log(`dyngja ${VERSION}`);
		return;
	}

	const value = (name: string) => flagValue(parsed, name);
	const featureFlags = {
		...flags,
		subcommand: parsed.positionals[1],
		positionals: parsed.positionals.slice(1),
		...Object.fromEntries(
			Object.entries(parsed.flags).map(([key, item]) => [
				key.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase()),
				item,
			]),
		),
	};

	switch (command) {
		case "login":
			return loginCommand({ email: value("email"), password: value("password"), ...flags });
		case "logout":
			return logoutCommand(flags);
		case "whoami":
			return whoamiCommand(flags);
		case "profile":
			return profileCommand(featureFlags);
		case "account":
			return accountCommand(featureFlags);
		case "market":
			return marketCommand(featureFlags);
		case "portfolio":
		case "holdings":
			return portfolioCommand(featureFlags);
		case "buy":
		case "sell":
			return tradeCommand({
				...flags,
				action: command,
				stockType: value("stock-type"),
				ticker: value("ticker") ?? value("symbol"),
				units: value("units"),
				rate: value("rate"),
				businessAccountId: value("business-account-id"),
			});
		case "trade":
			return tradeCommand({
				...flags,
				action: parsed.positionals[1],
				stockType: value("stock-type"),
				ticker: value("ticker") ?? value("symbol"),
				units: value("units"),
				rate: value("rate"),
				businessAccountId: value("business-account-id"),
			});
		case "transactions":
			return transactionsCommand({ count: value("count"), ...flags });
		case "history":
			return historyCommand(featureFlags);
		case "contests":
			return contestsCommand(featureFlags);
		case "users":
			return usersCommand(featureFlags);
		case "education":
			return educationCommand(featureFlags);
		case "analytics":
			return analyticsCommand(featureFlags);
		case "ads":
			return adsCommand(featureFlags);
		case "api":
			return apiCommand(featureFlags);
		case "info":
			return infoCommand(flags);
		case "register":
			return registerCommand({
				email: value("email"),
				password: value("password"),
				name: value("name"),
				...flags,
			});
		case "confirm":
			return confirmCommand({ email: value("email"), code: value("code"), ...flags });
		case "resend":
			return resendCommand({ email: value("email"), ...flags });
		case "doctor":
			return doctorCommand(flags);
		case "schema":
			return schemaCommand({ command: parsed.positionals[1], ...flags });
		default:
			console.error(color.red(`Unknown command: ${command}`));
			console.error(`Run ${color.bold("dyngja help")}.`);
			process.exit(64);
	}
}

main().catch((error: unknown) => {
	const parsed = parseArgs();
	const json = hasFlag(parsed, "json");
	if (error instanceof AuthError) dieAuth("rejected", json);
	const message = error instanceof Error ? error.message : String(error);
	if (json) {
		const status = error instanceof ApiError ? error.status : undefined;
		const details = error instanceof ApiError ? error.details : undefined;
		console.error(JSON.stringify({ error: message, status, details }));
	} else console.error(color.red(`Error: ${message}`));
	process.exit(error instanceof ApiError && error.status === 401 ? 2 : 1);
});
