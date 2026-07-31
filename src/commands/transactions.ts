import { dateTime, money } from "../lib/format.ts";
import { normalizeTransactions } from "../lib/normalize.ts";
import { color, die, isJsonMode, printJson } from "../lib/output.ts";
import { authedClient } from "../lib/session.ts";

export async function transactionsCommand(flags: {
	count?: string;
	json?: boolean;
	pretty?: boolean;
	raw?: boolean;
}): Promise<void> {
	const json = isJsonMode(flags);
	let count: number | undefined;
	if (flags.count !== undefined) {
		count = Number(flags.count);
		if (!Number.isInteger(count) || count < 1) die("--count must be a positive integer.", 64, json);
	}

	const raw = await authedClient(json).getTransactions(count);
	if (flags.raw) {
		printJson(raw);
		return;
	}
	const result = normalizeTransactions(raw);
	if (json) {
		printJson(result);
		return;
	}
	if (result.transactions.length === 0) {
		console.log("No transactions found.");
		return;
	}
	console.log(color.bold(`${result.count} transaction${result.count === 1 ? "" : "s"}`));
	for (const transaction of result.transactions) {
		const label = [transaction.type, transaction.ticker].filter(Boolean).join(" ") || "transaction";
		const units = transaction.units == null ? "" : ` × ${transaction.units}`;
		console.log(`  ${dateTime(transaction.date)}  ${label}${units}  ${money(transaction.amount)}`);
	}
}
