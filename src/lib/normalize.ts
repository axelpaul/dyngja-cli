import type {
	AppInfo,
	BusinessAccountSummary,
	TransactionList,
	TransactionSummary,
	UserSummary,
} from "./types.ts";

export function record(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function stringValue(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

export function numberValue(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function first(...values: unknown[]): unknown {
	return values.find((value) => value !== undefined && value !== null);
}

export function normalizeAccount(value: unknown): BusinessAccountSummary {
	const account = record(value);
	return {
		id: stringValue(account.id),
		balance: numberValue(account.balance),
		initialBalance: numberValue(account.initial_balance),
		contestId: stringValue(account.contest_id),
		transactionCount: numberValue(account.number_of_transactions),
	};
}

export function normalizeUser(value: unknown): UserSummary {
	const envelope = record(value);
	const user = record(envelope.user ?? value);
	const _profile = record(user.profile);
	const accounts = Array.isArray(user.main_business_account) ? user.main_business_account : [];
	const firstAccount = accounts[0];
	const firstName = stringValue(first(user.first_name, user.firstName));
	const lastName = stringValue(first(user.last_name, user.lastName));

	return {
		id: numberValue(user.id),
		username: stringValue(user.username),
		email: stringValue(user.email),
		name: [firstName, lastName].filter(Boolean).join(" ") || lastName || null,
		mainAccount: firstAccount === undefined ? null : normalizeAccount(firstAccount),
	};
}

export function normalizeAppInfo(value: unknown): AppInfo {
	const info = record(value);
	return {
		delayed_data: typeof info.delayed_data === "boolean" ? info.delayed_data : null,
		sale_commission: numberValue(info.sale_commission),
	};
}

function transactionSummary(value: unknown): TransactionSummary {
	const transaction = record(value);
	const stock = record(transaction.stock ?? transaction.Stock);
	return {
		id:
			typeof transaction.id === "number" || typeof transaction.id === "string"
				? transaction.id
				: null,
		type: stringValue(first(transaction.type, transaction.action, transaction.transaction_type)),
		ticker: stringValue(first(transaction.ticker, transaction.symbol, stock.ticker, stock.symbol)),
		units: numberValue(first(transaction.units, transaction.quantity)),
		rate: numberValue(first(transaction.rate, transaction.price)),
		amount: numberValue(transaction.amount),
		commission: numberValue(transaction.commission),
		date: stringValue(first(transaction.date, transaction.created_at, transaction.createdAt)),
	};
}

export function normalizeTransactions(value: unknown): TransactionList {
	const envelope = record(value);
	const items = Array.isArray(value)
		? value
		: Array.isArray(envelope.results)
			? envelope.results
			: Array.isArray(envelope.transactions)
				? envelope.transactions
				: [];
	return { count: items.length, transactions: items.map(transactionSummary) };
}
