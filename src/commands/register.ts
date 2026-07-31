import { DyngjaClient } from "../lib/api.ts";
import { die, isJsonMode, printJson } from "../lib/output.ts";
import { ask } from "../lib/prompt.ts";
import { loadConfig } from "../lib/storage.ts";

export async function registerCommand(flags: {
	email?: string;
	password?: string;
	name?: string;
	json?: boolean;
	pretty?: boolean;
}): Promise<void> {
	const json = isJsonMode(flags);
	const email =
		flags.email ??
		process.env.DYNGJA_USER ??
		process.env.DYNGJA_EMAIL ??
		(await ask("Dyngja email: "));
	if (!email) die("No email provided.", 64, json);
	const password =
		flags.password ??
		process.env.DYNGJA_PW ??
		process.env.DYNGJA_PASSWORD ??
		(await ask("Password: ", { mask: true }));
	if (!password) die("No password provided.", 64, json);

	try {
		const response = await new DyngjaClient({ baseUrl: loadConfig().baseUrl }).register(
			email,
			password,
			flags.name,
		);
		if (json) printJson({ step: "registered", response });
		else console.log("Account created. Check your email for the confirmation code.");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		die(`Registration failed: ${message}`, 1, json);
	}
}
