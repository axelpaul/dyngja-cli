import type {
	AppInfo,
	BusinessAccountSummary,
	OwnershipList,
	OwnershipSummary,
	StockList,
	StockSummary,
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
	if (typeof value === "string" && value.length > 0) return value;
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return null;
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

function collection(value: unknown, keys: string[]): unknown[] {
	if (Array.isArray(value)) return value;
	const envelope = record(value);
	for (const key of keys) if (Array.isArray(envelope[key])) return envelope[key] as unknown[];
	if (Array.isArray(envelope.results)) return envelope.results;
	if (Array.isArray(envelope.data)) return envelope.data;
	return [];
}

export function normalizeAccount(value: unknown): BusinessAccountSummary {
	const account = record(value);
	return {
		id: stringValue(account.id),
		balance: numberValue(account.balance),
		initialBalance: numberValue(account.initial_balance ?? account.initialBalance),
		contestId: stringValue(account.contest_id ?? account.contestId),
		transactionCount: numberValue(
			account.number_of_transactions ?? account.transaction_count ?? account.transactionCount,
		),
	};
}

export function normalizeUser(value: unknown): UserSummary {
	const envelope = record(value);
	const user = record(envelope.user ?? value);
	const rawAccounts = first(user.main_business_account, user.mainBusinessAccount);
	const accounts = Array.isArray(rawAccounts)
		? rawAccounts
		: rawAccounts !== null && typeof rawAccounts === "object"
			? [rawAccounts]
			: [];
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

export function normalizeTransaction(value: unknown): TransactionSummary {
	const transaction = record(value);
	const stock = record(transaction.stock ?? transaction.Stock);
	return {
		id:
			typeof transaction.id === "number" || typeof transaction.id === "string"
				? transaction.id
				: null,
		type: stringValue(first(transaction.type, transaction.action, transaction.transaction_type)),
		ticker: stringValue(first(transaction.ticker, transaction.symbol, stock.ticker, stock.symbol)),
		stockType: first(transaction.stock_type, transaction.stockType, stock.id) as
			| string
			| number
			| null,
		units: numberValue(first(transaction.units, transaction.quantity)),
		rate: numberValue(first(transaction.rate, transaction.price)),
		amount: numberValue(first(transaction.amount, transaction.total)),
		commission: numberValue(transaction.commission),
		connection: stringValue(transaction.connection),
		date: stringValue(first(transaction.date, transaction.created_at, transaction.createdAt)),
	};
}

export function normalizeTransactions(value: unknown): TransactionList {
	const items = collection(value, ["transactions", "items"]);
	return { count: items.length, transactions: items.map(normalizeTransaction) };
}

export function normalizeOwnership(value: unknown): OwnershipSummary {
	const ownership = record(value);
	const stock = record(ownership.stock ?? ownership.Stock ?? ownership.stock_type);
	const units = numberValue(
		first(ownership.units, ownership.units_owned, ownership.quantity, ownership.number_of_units),
	);
	const marketRate = numberValue(
		first(
			ownership.market_rate,
			ownership.current_rate,
			ownership.price,
			stock.current_rate,
			stock.price,
		),
	);
	const reportedValue = numberValue(
		first(ownership.value, ownership.total_value, ownership.market_value),
	);
	return {
		id: typeof ownership.id === "number" || typeof ownership.id === "string" ? ownership.id : null,
		ticker: stringValue(
			first(ownership.ticker, ownership.symbol, stock.ticker, stock.symbol, ownership.stock_name),
		),
		stockType: first(ownership.stock_type, ownership.stockType, stock.id) as string | number | null,
		units,
		averageRate: numberValue(
			first(ownership.average_rate, ownership.avg_rate, ownership.averageRate, ownership.rate),
		),
		marketRate,
		value: reportedValue ?? (units !== null && marketRate !== null ? units * marketRate : null),
		profit: numberValue(first(ownership.profit, ownership.return, ownership.gain)),
		businessAccountId: stringValue(
			first(ownership.business_account_id, ownership.business_account, ownership.account_id),
		),
	};
}

export function normalizeOwnerships(value: unknown): OwnershipList {
	const items = collection(value, ["ownerships", "holdings", "items"]);
	return { count: items.length, ownerships: items.map(normalizeOwnership) };
}

export function normalizeStock(value: unknown): StockSummary {
	const stock = record(value);
	const company = record(stock.company ?? stock.issuer);
	return {
		id: typeof stock.id === "number" || typeof stock.id === "string" ? stock.id : null,
		ticker: stringValue(
			first(stock.ticker, stock.symbol, stock.stock_symbol, stock.stockSymbol, stock.code),
		),
		name: stringValue(
			first(
				stock.name,
				stock.company_name,
				stock.companyName,
				stock.title,
				company.name,
				company.title,
			),
		),
		price: numberValue(
			first(
				stock.price,
				stock.rate,
				stock.current_price,
				stock.currentPrice,
				stock.current_rate,
				stock.currentRate,
				stock.last_price,
				stock.lastPrice,
			),
		),
		stockType: first(stock.stock_type, stock.stockType, stock.id) as string | number | null,
	};
}

export function normalizeStocks(value: unknown): StockList {
	const items = collection(value, ["stocks", "items"]);
	return { count: items.length, stocks: items.map(normalizeStock) };
}
