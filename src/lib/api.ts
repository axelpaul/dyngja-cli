import type { AppInfo, LoginResponse } from "./types.ts";

export const DEFAULT_BASE_URL = "https://dyngja.reynirf.com";

interface RequestOptions {
	method?: "GET" | "POST" | "PATCH";
	body?: unknown;
	auth?: boolean;
}

export class ApiError extends Error {
	readonly status: number;
	readonly details: unknown;

	constructor(status: number, details: unknown) {
		super(`Dyngja API request failed with HTTP ${status}`);
		this.name = "ApiError";
		this.status = status;
		this.details = details;
	}
}

export class AuthError extends ApiError {
	constructor(details: unknown) {
		super(401, details);
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
		const { method = "GET", body, auth = true } = options;
		const url =
			path.startsWith("http://") || path.startsWith("https://")
				? path
				: `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
		const headers = new Headers({ Accept: "application/json" });
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
		if (!response.ok) throw new ApiError(response.status, data);
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
			body: {
				type: "app",
				username: email,
				email,
				password,
				...(name ? { name } : {}),
			},
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
		return this.request("/auth/re-send/", {
			method: "POST",
			auth: false,
			body: { email },
		});
	}

	getAppInfo(): Promise<AppInfo> {
		return this.request<AppInfo>("/api/v3/app-info/", { auth: false });
	}

	getMe() {
		return this.request("/api/v3/users/myself/");
	}

	getTransactions(count?: number) {
		const query = count === undefined ? "" : `?count=${encodeURIComponent(String(count))}`;
		return this.request(`/api/v3/transactions/${query}`);
	}
}
