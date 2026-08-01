import { color, die, isJsonMode, printJson } from "../lib/output.ts";

interface CommandSchema {
	command: string;
	requiresAuth: boolean;
	mutates: boolean;
	shape: unknown;
}

const schemas: Record<string, CommandSchema> = {
	whoami: {
		command: "whoami",
		requiresAuth: true,
		mutates: false,
		shape: { id: "number | null", email: "string | null", mainAccount: "object | null" },
	},
	portfolio: {
		command: "portfolio",
		requiresAuth: true,
		mutates: false,
		shape: {
			count: "number",
			ownerships: [{ ticker: "string | null", units: "number | null", value: "number | null" }],
		},
	},
	transactions: {
		command: "transactions",
		requiresAuth: true,
		mutates: false,
		shape: {
			count: "number",
			transactions: [{ type: "string | null", ticker: "string | null", units: "number | null" }],
		},
	},
	trade: {
		command: "buy|sell",
		requiresAuth: true,
		mutates: true,
		shape: {
			action: "buy | sell",
			request: {
				units: "number",
				symbol: "string",
				type: "buy | sell",
				business_account_id: "string | number",
			},
			response: "object",
		},
	},
	info: {
		command: "info",
		requiresAuth: false,
		mutates: false,
		shape: { delayed_data: "boolean | null", sale_commission: "number | null" },
	},
	doctor: {
		command: "doctor",
		requiresAuth: false,
		mutates: false,
		shape: {
			status: "'ok' | 'warn' | 'fail'",
			checks: [{ name: "string", status: "string", detail: "string" }],
		},
	},
};

export async function schemaCommand(flags: {
	command?: string;
	json?: boolean;
	pretty?: boolean;
}): Promise<void> {
	const json = isJsonMode(flags);
	if (!flags.command) {
		if (json) printJson({ commands: Object.values(schemas) });
		else {
			console.log(color.bold("Schemas available:"));
			for (const name of Object.keys(schemas)) console.log(`  ${name}`);
			console.log(`\n${color.dim("Run dyngja schema <command> --json for a response shape.")}`);
		}
		return;
	}

	const schema = schemas[flags.command];
	if (!schema)
		die(`No schema for "${flags.command}". Known: ${Object.keys(schemas).join(", ")}`, 64, json);
	if (json) {
		printJson(schema);
		return;
	}
	console.log(color.bold(`dyngja ${schema.command}`));
	console.log(`  ${color.dim("requires_auth")} ${schema.requiresAuth}`);
	console.log(`  ${color.dim("mutates")}       ${schema.mutates}`);
	console.log(`\n${color.dim("Shape:")}`);
	console.log(JSON.stringify(schema.shape, null, 2));
}
