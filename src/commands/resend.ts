import { DyngjaClient } from "../lib/api.ts";
import { die, isJsonMode, printJson } from "../lib/output.ts";
import { loadConfig } from "../lib/storage.ts";

export async function resendCommand(flags: {
	email?: string;
	json?: boolean;
	pretty?: boolean;
}): Promise<void> {
	const json = isJsonMode(flags);
	const email = flags.email ?? process.env.DYNGJA_USER ?? process.env.DYNGJA_EMAIL;
	if (!email) die("Provide --email or DYNGJA_USER.", 64, json);
	const response = await new DyngjaClient({ baseUrl: loadConfig().baseUrl }).resendConfirmation(
		email,
	);
	if (json) printJson({ step: "confirmation_resent", response });
	else console.log("Confirmation code sent.");
}
