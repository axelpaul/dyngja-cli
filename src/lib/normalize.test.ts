import { describe, expect, test } from "bun:test";
import { normalizeStocks, normalizeTransactions, normalizeUser } from "./normalize.ts";

describe("normalize", () => {
	test("normalizes the current user and virtual account", () => {
		const user = normalizeUser({
			id: 12,
			username: "trader@example.com",
			email: "trader@example.com",
			last_name: "Trader",
			main_business_account: [
				{ id: "account-1", balance: "1000000.00", number_of_transactions: 2 },
			],
		});

		expect(user).toEqual({
			id: 12,
			username: "trader@example.com",
			email: "trader@example.com",
			name: "Trader",
			mainAccount: {
				id: "account-1",
				balance: 1000000,
				initialBalance: null,
				contestId: null,
				transactionCount: 2,
			},
		});
	});

	test("normalizes transaction lists", () => {
		const result = normalizeTransactions({
			results: [{ id: 1, type: "BUY", ticker: "MAREL", units: "3", amount: "450" }],
		});
		expect(result.count).toBe(1);
		expect(result.transactions[0]?.ticker).toBe("MAREL");
		expect(result.transactions[0]?.units).toBe(3);
	});

	test("normalizes current market stock fields", () => {
		const result = normalizeStocks([
			{ id: 7, symbol: "MAREL", company: { name: "Marel hf." }, current_rate: "92.5" },
		]);

		expect(result).toEqual({
			count: 1,
			stocks: [{ id: 7, ticker: "MAREL", name: "Marel hf.", price: 92.5, stockType: 7 }],
		});
	});
});
