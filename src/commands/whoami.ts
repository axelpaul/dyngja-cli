import { AuthError } from "../lib/api.ts";
import { dateTime, money } from "../lib/format.ts";
import { normalizeUser } from "../lib/normalize.ts";
import { color, dieAuth, isJsonMode, printJson } from "../lib/output.ts";
import { authedClient } from "../lib/session.ts";

export async function whoamiCommand(flags: {
	json?: boolean;
	pretty?: boolean;
	raw?: boolean;
}): Promise<void> {
	const json = isJsonMode(flags);
	const client = authedClient(json);
	try {
		const raw = await client.getMe();
		if (flags.raw) {
			printJson(raw);
			return;
		}
		const user = normalizeUser(raw);
		if (json) {
			printJson(user);
			return;
		}
		console.log(color.bold(user.name ?? user.email ?? "Dyngja user"));
		console.log(`  ${color.dim("email")}       ${user.email ?? "—"}`);
		console.log(`  ${color.dim("username")}    ${user.username ?? "—"}`);
		if (user.mainAccount) {
			console.log(`  ${color.dim("balance")}     ${money(user.mainAccount.balance)}`);
			console.log(`  ${color.dim("transactions")} ${user.mainAccount.transactionCount ?? "—"}`);
		}
	} catch (error) {
		if (error instanceof AuthError) dieAuth("rejected", json);
		throw error;
	}
}

void dateTime;
