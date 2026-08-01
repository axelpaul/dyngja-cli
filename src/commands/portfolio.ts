import { printData, textFlag } from "../lib/command.ts";
import { money } from "../lib/format.ts";
import { normalizeOwnerships } from "../lib/normalize.ts";
import { isJsonMode } from "../lib/output.ts";
import { authedClient } from "../lib/session.ts";
import type { CommandFlags } from "../lib/types.ts";

export async function portfolioCommand(
	flags: CommandFlags & {
		accountId?: string;
		userId?: string;
		contestId?: string;
		count?: string;
		sort?: string;
	},
): Promise<void> {
	const json = isJsonMode(flags);
	const query = {
		...(textFlag(flags, "accountId") ? { business_account_id: textFlag(flags, "accountId") } : {}),
		...(textFlag(flags, "userId") ? { user_id: textFlag(flags, "userId") } : {}),
		...(textFlag(flags, "contestId") ? { contest_id: textFlag(flags, "contestId") } : {}),
		...(textFlag(flags, "count") ? { count: textFlag(flags, "count") } : {}),
		...(textFlag(flags, "sort") ? { sortType: textFlag(flags, "sort") } : {}),
	};
	const raw = await authedClient(json).getOwnerships(query);
	if (flags.raw) {
		printData(raw, flags);
		return;
	}
	const result = normalizeOwnerships(raw);
	if (json) {
		printData(raw, flags, result);
		return;
	}
	if (result.count === 0) {
		console.log("No holdings found.");
		return;
	}
	console.log(`${result.count} holding${result.count === 1 ? "" : "s"}`);
	for (const holding of result.ownerships) {
		const label = holding.ticker ?? String(holding.stockType ?? "stock");
		console.log(
			`  ${label.padEnd(12)} ${String(holding.units ?? "—").padStart(8)}  ${money(holding.value)}`,
		);
	}
}
