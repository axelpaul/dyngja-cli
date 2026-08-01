export type JsonObject = Record<string, unknown>;

export type QueryValue = string | number | boolean | null | undefined;

export interface OutputFlags {
	json?: boolean;
	pretty?: boolean;
	raw?: boolean;
}

export interface CommandFlags extends OutputFlags {
	yes?: boolean;
	dryRun?: boolean;
}

export interface UserSummary {
	id: number | null;
	username: string | null;
	email: string | null;
	name: string | null;
	mainAccount: BusinessAccountSummary | null;
}

export interface BusinessAccountSummary {
	id: string | null;
	balance: number | null;
	initialBalance: number | null;
	contestId: string | null;
	transactionCount: number | null;
}

export interface AuthState {
	token: string;
	user: UserSummary | null;
	loggedInAt: string;
}

export interface UserConfig {
	baseUrl?: string;
}

export interface AppInfo {
	delayed_data: boolean | null;
	sale_commission: number | null;
}

export interface TransactionSummary {
	id: string | number | null;
	type: string | null;
	ticker: string | null;
	stockType: string | number | null;
	units: number | null;
	rate: number | null;
	amount: number | null;
	commission: number | null;
	connection: string | null;
	date: string | null;
}

export interface TransactionList {
	count: number;
	transactions: TransactionSummary[];
}

export interface OwnershipSummary {
	id: string | number | null;
	ticker: string | null;
	stockType: string | number | null;
	units: number | null;
	averageRate: number | null;
	marketRate: number | null;
	value: number | null;
	profit: number | null;
	businessAccountId: string | null;
}

export interface OwnershipList {
	count: number;
	ownerships: OwnershipSummary[];
}

export interface StockSummary {
	id: string | number | null;
	ticker: string | null;
	name: string | null;
	price: number | null;
	stockType: string | number | null;
}

export interface StockList {
	count: number;
	stocks: StockSummary[];
}

export interface LoginResponse {
	token: string;
	user?: unknown;
}
