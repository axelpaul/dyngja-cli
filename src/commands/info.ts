import { DyngjaClient } from "../lib/api.ts";
import { normalizeAppInfo } from "../lib/normalize.ts";
import { color, isJsonMode, printJson } from "../lib/output.ts";
import { loadConfig } from "../lib/storage.ts";

export async function infoCommand(flags: {
	json?: boolean;
	pretty?: boolean;
	raw?: boolean;
}): Promise<void> {
	const json = isJsonMode(flags);
	const client = new DyngjaClient({ baseUrl: loadConfig().baseUrl });
	const raw = await client.getAppInfo();
	if (flags.raw) {
		printJson(raw);
		return;
	}
	const info = normalizeAppInfo(raw);
	if (json) {
		printJson(info);
		return;
	}
	console.log(color.bold("Dyngja"));
	console.log(
		`  ${color.dim("market data")}  ${info.delayed_data === true ? "delayed" : info.delayed_data === false ? "live" : "unknown"}`,
	);
	console.log(`  ${color.dim("sale fee")}     ${info.sale_commission ?? "—"}`);
}
