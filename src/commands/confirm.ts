import { DyngjaClient } from "../lib/api.ts";
import { normalizeUser } from "../lib/normalize.ts";
import { die, isJsonMode, printJson } from "../lib/output.ts";
import { loadConfig, saveAuth } from "../lib/storage.ts";

export async function confirmCommand(flags: {
	email?: string;
	code?: string;
	json?: boolean;
	pretty?: boolean;
}): Promise<void> {
	const json = isJsonMode(flags);
	const email = flags.email ?? process.env.DYNGJA_USER ?? process.env.DYNGJA_EMAIL;
	if (!email) die("Provide --email or DYNGJA_USER.", 64, json);
	if (!flags.code) die("Provide --code.", 64, json);

	const response = await new DyngjaClient({ baseUrl: loadConfig().baseUrl }).confirmAccount(
		email,
		flags.code,
	);
	const user = response.user ? normalizeUser(response.user) : null;
	if (response.token) {
		saveAuth({ token: response.token, user, loggedInAt: new Date().toISOString() });
	}
	if (json) printJson({ step: "confirmed", user });
	else console.log(response.token ? "Account confirmed and session saved." : "Account confirmed.");
}
