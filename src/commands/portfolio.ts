import { printData, textFlag } from "../lib/command.ts";
import { money } from "../lib/format.ts";
import { normalizeOwnerships } from "../lib/normalize.ts";
import { isJsonMode } from "../lib/output.ts";
import { fetchPortfolio } from "../lib/queries.ts";
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
	const raw = await fetchPortfolio(authedClient(json), {
		businessAccountId: textFlag(flags, "account-id") ?? textFlag(flags, "business-account-id"),
		userId: textFlag(flags, "user-id"),
		contestId: textFlag(flags, "contest-id"),
		count: textFlag(flags, "count"),
		sort: textFlag(flags, "sort"),
	});
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
