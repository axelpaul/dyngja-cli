import { AuthError, DyngjaClient } from "../lib/api.ts";
import { normalizeUser } from "../lib/normalize.ts";
import { color, die, isJsonMode, printJson } from "../lib/output.ts";
import { ask } from "../lib/prompt.ts";
import { loadConfig, saveAuth } from "../lib/storage.ts";

interface LoginFlags {
	email?: string;
	password?: string;
	json?: boolean;
	pretty?: boolean;
}

export async function loginCommand(flags: LoginFlags): Promise<void> {
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

	const client = new DyngjaClient({ baseUrl: loadConfig().baseUrl });
	try {
		const response = await client.login(email, password);
		if (!response.token) die("Login succeeded without a token.", 1, json);
		const authenticated = new DyngjaClient({
			baseUrl: loadConfig().baseUrl,
			token: response.token,
		});
		let user = response.user ? normalizeUser(response.user) : null;
		try {
			user = normalizeUser(await authenticated.getMe());
		} catch {
			// The token is still useful if the profile endpoint is temporarily unavailable.
		}
		saveAuth({ token: response.token, user, loggedInAt: new Date().toISOString() });
		if (json) printJson({ step: "logged_in", user });
		else console.log(color.green(`✓ Logged in as ${user?.email ?? email}.`));
	} catch (error) {
		if (error instanceof AuthError) die("Login rejected. Check the email and password.", 1, json);
		const message = error instanceof Error ? error.message : String(error);
		die(`Login failed: ${message}`, 1, json);
	}
}
