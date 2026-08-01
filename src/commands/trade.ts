import { positiveNumber, requireMutationConfirmation } from "../lib/command.ts";
import { money } from "../lib/format.ts";
import { normalizeUser } from "../lib/normalize.ts";
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
		businessAccountId?: string;
	},
): Promise<void> {
	const json = isJsonMode(flags);
	const action = flags.action;
	if (action !== "buy" && action !== "sell") die("Trade action must be buy or sell.", 64, json);
	const tradeType = action as "buy" | "sell";
	const stockInput = flags.ticker ?? flags.stockType;
	if (!stockInput) die("Provide --ticker (or --stock-type).", 64, json);
	const units = positiveNumber(flags.units, "units", json);
	const rate = flags.rate === undefined ? undefined : positiveNumber(flags.rate, "rate", json);
	const payload = {
		units,
		symbol: stockInput,
		type: tradeType,
		business_account_id: flags.businessAccountId ?? null,
	};

	if (flags.dryRun) {
		const result = {
			action,
			request: payload,
			dry_run: true,
			...(rate === undefined ? {} : { estimated_rate: rate, estimated_total: money(units * rate) }),
		};
		printJson(result);
		return;
	}
	requireMutationConfirmation(flags, action === "buy" ? "Buying" : "Selling", json);
	const client = authedClient(json);
	let businessAccountId = flags.businessAccountId;
	if (!businessAccountId) {
		const user = normalizeUser(await client.getMe());
		businessAccountId = user.mainAccount?.id ?? undefined;
	}
	if (!businessAccountId)
		die("Dyngja did not return a business account. Provide --business-account-id.", 64, json);
	const request = { ...payload, business_account_id: businessAccountId };
	const response = await client.createMarketTransaction(request);
	if (json || flags.raw) {
		printJson(flags.raw ? response : { action, request, response });
		return;
	}
	console.log(
		`${action === "buy" ? "Buy" : "Sell"} order sent for ${units} unit${units === 1 ? "" : "s"}.`,
	);
	console.log(JSON.stringify(response, null, 2));
}
