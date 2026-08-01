import { positiveNumber, requireMutationConfirmation, scalarValue } from "../lib/command.ts";
import { money } from "../lib/format.ts";
import { die, isJsonMode, printJson } from "../lib/output.ts";
import { authedClient } from "../lib/session.ts";
import type { CommandFlags } from "../lib/types.ts";

export async function tradeCommand(
	flags: CommandFlags & {
		action?: string;
		stockType?: string;
		ticker?: string;
		units?: string;
		rate?: string;
	},
): Promise<void> {
	const json = isJsonMode(flags);
	const action = flags.action;
	if (action !== "buy" && action !== "sell") die("Trade action must be buy or sell.", 64, json);
	const stockInput = flags.stockType ?? flags.ticker;
	if (!stockInput) die("Provide --stock-type (or --ticker).", 64, json);
	const units = positiveNumber(flags.units, "units", json);
	const rate = positiveNumber(flags.rate, "rate", json);
	const payload = {
		rate,
		stock_type: scalarValue(stockInput),
		units: action === "sell" ? -units : units,
	};

	if (flags.dryRun) {
		const result = { action, request: payload, dry_run: true, total: money(units * rate) };
		printJson(result);
		return;
	}
	requireMutationConfirmation(flags, action === "buy" ? "Buying" : "Selling", json);
	const response = await authedClient(json).createTransaction(payload);
	if (json || flags.raw) {
		printJson(flags.raw ? response : { action, request: payload, response });
		return;
	}
	console.log(
		`${action === "buy" ? "Buy" : "Sell"} order sent for ${units} unit${units === 1 ? "" : "s"}.`,
	);
	console.log(JSON.stringify(response, null, 2));
}
