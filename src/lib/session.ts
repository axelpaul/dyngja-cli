import { AuthError, DyngjaClient } from "./api.ts";
import { dieAuth } from "./output.ts";
import { loadAuth, loadConfig } from "./storage.ts";

/** Client for the saved session. Throws AuthError (never exits) when there is no session. */
export function sessionClient(): DyngjaClient {
	const auth = loadAuth();
	if (!auth?.token)
		throw new AuthError({ detail: 'Not logged in. Run "dyngja login" in a terminal first.' });
	return new DyngjaClient({ baseUrl: loadConfig().baseUrl, token: auth.token });
}

/** Unauthenticated client for public routes. */
export function publicClient(): DyngjaClient {
	return new DyngjaClient({ baseUrl: loadConfig().baseUrl });
}

/** CLI helper: exits with code 2 when there is no saved session. */
export function authedClient(json: boolean): DyngjaClient {
	const auth = loadAuth();
	if (!auth?.token) dieAuth("not_logged_in", json);
	return new DyngjaClient({ baseUrl: loadConfig().baseUrl, token: auth.token });
}
