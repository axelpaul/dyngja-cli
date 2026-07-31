import { DyngjaClient } from "./api.ts";
import { dieAuth } from "./output.ts";
import { loadAuth, loadConfig } from "./storage.ts";

export function authedClient(json: boolean): DyngjaClient {
	const auth = loadAuth();
	if (!auth?.token) dieAuth("not_logged_in", json);
	return new DyngjaClient({ baseUrl: loadConfig().baseUrl, token: auth.token });
}
