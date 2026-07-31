import { isJsonMode, printJson } from "../lib/output.ts";
import { clearAuth, loadAuth } from "../lib/storage.ts";

export async function logoutCommand(flags: { json?: boolean; pretty?: boolean }): Promise<void> {
	const json = isJsonMode(flags);
	const wasLoggedIn = loadAuth() !== null;
	clearAuth();
	if (json) printJson({ logged_out: wasLoggedIn });
	else console.log(wasLoggedIn ? "Logged out." : "No active session.");
}
