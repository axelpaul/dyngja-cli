import type { AppInfo, JsonObject, LoginResponse, QueryValue } from "./types.ts";

export const DEFAULT_BASE_URL = "https://dyngja.reynirf.com";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export type QueryParams = Record<string, QueryValue>;

export interface RequestOptions {
	method?: HttpMethod;
	body?: unknown;
	query?: QueryParams;
	auth?: boolean;
	headers?: Record<string, string>;
}

function apiErrorMessage(details: unknown): string | null {
	if (typeof details === "string" && details.trim() !== "") return details;
	if (details === null || typeof details !== "object" || Array.isArray(details)) return null;
	const object = details as Record<string, unknown>;
	for (const key of ["message", "detail", "error", "type"]) {
		const value = object[key];
		if (typeof value === "string" && value.trim() !== "") return value;
	}
	return null;
}

function withQuery(path: string, query?: QueryParams): string {
	if (!query) return path;
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== null) params.set(key, String(value));
	}
	if (!params.toString()) return path;
	return `${path}${path.includes("?") ? "&" : "?"}${params.toString()}`;
}

export class ApiError extends Error {
	readonly status: number;
	readonly details: unknown;
	readonly method: HttpMethod;
	readonly path: string;

	constructor(status: number, details: unknown, method: HttpMethod = "GET", path = "") {
		const detail = apiErrorMessage(details);
		super(detail ? `Dyngja API: ${detail}` : `Dyngja API request failed with HTTP ${status}`);
		this.name = "ApiError";
		this.status = status;
		this.details = details;
		this.method = method;
		this.path = path;
	}
}

export class AuthError extends ApiError {
	constructor(details: unknown) {
		super(401, details, "GET");
		this.name = "AuthError";
	}
}

export class DyngjaClient {
	readonly baseUrl: string;
	readonly token?: string;

	constructor(options: { baseUrl?: string; token?: string } = {}) {
		this.baseUrl = (options.baseUrl ?? process.env.DYNGJA_API_URL ?? DEFAULT_BASE_URL).replace(
			/\/+$/,
			"",
		);
		this.token = options.token;
	}

	async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
		const { method = "GET", body, query, auth = true, headers: extraHeaders } = options;
		const relativePath = withQuery(path, query);
		const url =
			path.startsWith("http://") || path.startsWith("https://")
				? relativePath
				: `${this.baseUrl}${relativePath.startsWith("/") ? relativePath : `/${relativePath}`}`;
		const headers = new Headers({ Accept: "application/json", ...extraHeaders });
		if (body !== undefined) headers.set("Content-Type", "application/json");
		if (auth) {
			if (!this.token) throw new AuthError({ detail: "Missing token" });
			headers.set("Authorization", `Token ${this.token}`);
		}

		const response = await fetch(url, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const raw = await response.text();
		let data: unknown = null;
		if (raw) {
			try {
				data = JSON.parse(raw);
			} catch {
				data = raw;
			}
		}
		if (response.status === 401) throw new AuthError(data);
		if (!response.ok) throw new ApiError(response.status, data, method, relativePath);
		return data as T;
	}

	login(username: string, password: string): Promise<LoginResponse> {
		return this.request<LoginResponse>("/auth/login/", {
			method: "POST",
			auth: false,
			body: { username, password },
		});
	}

	register(email: string, password: string, name?: string) {
		return this.request("/auth/register/", {
			method: "POST",
			auth: false,
			body: { type: "app", username: email, email, password, ...(name ? { name } : {}) },
		});
	}

	confirmAccount(email: string, code: string) {
		return this.request<{ token?: string; user?: unknown }>("/auth/confirm-account/", {
			method: "POST",
			auth: false,
			body: { email, code },
		});
	}

	resendConfirmation(email: string) {
		return this.request("/auth/re-send/", { method: "POST", auth: false, body: { email } });
	}

	getApiRoot() {
		return this.request<JsonObject>("/api/v3/", { auth: false });
	}

	getAppInfo(): Promise<AppInfo> {
		return this.request<AppInfo>("/api/v3/app-info/", { auth: false });
	}

	getAds() {
		return this.request("/api/v3/ads/", { auth: false });
	}

	getMe() {
		return this.request("/api/v3/users/");
	}

	getUser(id: string | number) {
		return this.request(`/api/v3/users/${encodeURIComponent(String(id))}/`);
	}

	patchUser(id: string | number, body: JsonObject) {
		return this.request(`/api/v3/users/${encodeURIComponent(String(id))}/`, {
			method: "PATCH",
			body,
		});
	}

	getTransactions(query?: QueryParams | number) {
		const params: QueryParams | undefined = typeof query === "number" ? { count: query } : query;
		return this.request("/api/v3/transactions/", { query: params });
	}

	createTransaction(body: { rate: number; stock_type: string | number; units: number }) {
		return this.request("/api/v3/transactions/", { method: "POST", body });
	}

	getOwnerships(query?: QueryParams) {
		return this.request("/api/v3/ownerships/", { query });
	}

	getMostFollowedUsers(userId: string | number) {
		return this.request(`/api/v3/users/${encodeURIComponent(String(userId))}/most_followed/`);
	}

	getContestOwnershipTotals(businessAccountIds: Array<string | number>, count?: number) {
		return this.request("/api/v3/ownerships/all/from_contest_total/", {
			method: "POST",
			query: count === undefined ? undefined : { count },
			body: { business_account_ids: businessAccountIds },
		});
	}

	getUserPositionInContest(body: JsonObject) {
		return this.request("/api/v3/ownerships/all/user_position_in_contest/", {
			method: "POST",
			body,
		});
	}

	getStocks(query?: QueryParams) {
		return this.request("/api/v3/stocks/", { query });
	}

	getBusinessAccount() {
		return this.request("/api/v3/users/self/business_account/");
	}

	patchBusinessAccount(body: JsonObject) {
		return this.request("/api/v3/users/self/business_account_patch/", { method: "POST", body });
	}

	getProfileInformation(businessAccountId?: string) {
		return this.request("/api/v3/profile_information/", {
			query: businessAccountId ? { business_account_id: businessAccountId } : undefined,
		});
	}

	getHistory(path: string, query?: QueryParams) {
		return this.request(path, { query });
	}

	getRecentTransactions(count?: number) {
		return this.getHistory("/api/v3/recent/", count === undefined ? undefined : { count });
	}

	getRecentTransactionsByBusinessAccountId(businessAccountId: string, count?: number) {
		return this.getHistory("/api/v3/recent/", {
			business_account_id: businessAccountId,
			...(count === undefined ? {} : { count }),
		});
	}

	getRecentMultiple(kind: "buy" | "sell", count?: number) {
		return this.getHistory(
			`/api/v3/recent_multiple_lazy_${kind}_new/`,
			count === undefined ? undefined : { count },
		);
	}

	getSalesLazy(count?: number) {
		return this.getHistory("/api/v3/sales_lazy/", count === undefined ? undefined : { count });
	}

	getPurchasesLazy(count?: number) {
		return this.getHistory("/api/v3/purchases_lazy/", count === undefined ? undefined : { count });
	}

	getSalesLazyFromId(id: string | number, count?: number) {
		return this.getHistory(
			`/api/v3/sales_lazy/${encodeURIComponent(String(id))}/`,
			count === undefined ? undefined : { count },
		);
	}

	getPurchasesLazyFromId(id: string | number, count?: number) {
		return this.getHistory(
			`/api/v3/purchases_lazy/${encodeURIComponent(String(id))}/`,
			count === undefined ? undefined : { count },
		);
	}

	getHistoricData(type?: string, stockType?: string) {
		return this.getHistory("/api/v3/historic-data/", {
			...(type ? { type } : {}),
			...(stockType ? { stockType } : {}),
		});
	}

	getTotalHistoryData(type?: string) {
		return this.getHistory("/api/v3/total-history-data/", type ? { type } : undefined);
	}

	getYesterdaysTotal(businessAccountId?: string) {
		const path = businessAccountId
			? "/api/v3/yesterdays_total/"
			: "/api/v3/users/self/yesterdays_total/";
		return this.getHistory(
			path,
			businessAccountId ? { business_account_id: businessAccountId } : undefined,
		);
	}

	getUserContests(query?: QueryParams) {
		return this.getHistory("/api/v3/contests/", query);
	}

	getRandomContests(query?: QueryParams) {
		return this.getHistory("/api/v3/contests/random/", query);
	}

	getContestById(id: string | number) {
		return this.getHistory(`/api/v3/contests/${encodeURIComponent(String(id))}/`);
	}

	searchContests(query: QueryParams) {
		return this.getHistory("/api/v3/contests/search/", query);
	}

	getContestParticipants(query?: QueryParams) {
		return this.getHistory("/api/v3/contests/participants/", query);
	}

	contestAction(path: string, body: unknown) {
		return this.request(path, { method: "POST", body });
	}

	getUsersByQuery(query: string) {
		return this.getHistory("/api/v3/search/", { query });
	}

	getMostProfitedUsers(query?: QueryParams) {
		return this.getHistory("/api/v3/most_profit/", query);
	}

	getNewsFeed(userId?: string | number) {
		return this.getHistory(
			userId === undefined
				? "/api/v3/news_feed/"
				: `/api/v3/users/${encodeURIComponent(String(userId))}/news_feed/`,
		);
	}

	getAchievements(userId?: string | number) {
		return this.getHistory(
			userId === undefined
				? "/api/v3/achievements/"
				: `/api/v3/users/${encodeURIComponent(String(userId))}/achievements/`,
		);
	}

	getChapters() {
		return this.getHistory("/api/v3/chapters/");
	}

	getEducationalProgress() {
		return this.getHistory("/api/v3/users/self/educational_progress/");
	}

	getVideos(query?: QueryParams) {
		return this.getHistory("/api/v3/videos/", query);
	}

	postSelf(path: string, body: unknown) {
		return this.request(path, { method: "POST", body });
	}

	getInvites() {
		return this.getHistory("/api/v3/contests/invites/");
	}

	getTeamStatistics(query?: QueryParams) {
		return this.getHistory("/api/v3/team-statistics-gpt/", query);
	}
}
