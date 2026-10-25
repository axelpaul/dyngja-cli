import type { DyngjaClient, MarketTransactionRequest } from "./api.ts";
import { normalizeUser } from "./normalize.ts";

export interface MarketOrderInput {
	type: "buy" | "sell";
	symbol: string;
	units: number;
	businessAccountId?: string;
}

export class MissingBusinessAccountError extends Error {
	constructor() {
		super("Dyngja did not return a business account. Provide a business account id.");
		this.name = "MissingBusinessAccountError";
	}
}

/** Resolve the account to trade with: the given id, or the signed-in user's main account. */
export async function resolveBusinessAccountId(
	client: DyngjaClient,
	businessAccountId?: string,
): Promise<string> {
	if (businessAccountId) return businessAccountId;
	const user = normalizeUser(await client.getMe());
	const id = user.mainAccount?.id;
	if (!id) throw new MissingBusinessAccountError();
	return id;
}

/** Send a virtual market order. Shared by the CLI `buy`/`sell` commands and the MCP `trade` tool. */
export async function placeMarketOrder(
	client: DyngjaClient,
	input: MarketOrderInput,
): Promise<{ request: MarketTransactionRequest; response: unknown }> {
	const request: MarketTransactionRequest = {
		units: input.units,
		symbol: input.symbol,
		type: input.type,
		business_account_id: await resolveBusinessAccountId(client, input.businessAccountId),
	};
	const response = await client.createMarketTransaction(request);
	return { request, response };
}
