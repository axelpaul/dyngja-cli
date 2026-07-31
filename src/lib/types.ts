export interface OutputFlags {
	json?: boolean;
	pretty?: boolean;
	raw?: boolean;
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
	units: number | null;
	rate: number | null;
	amount: number | null;
	commission: number | null;
	date: string | null;
}

export interface TransactionList {
	count: number;
	transactions: TransactionSummary[];
}

export interface LoginResponse {
	token: string;
	user?: unknown;
}
