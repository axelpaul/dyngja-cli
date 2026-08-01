import { afterEach, describe, expect, test } from "bun:test";
import { DyngjaClient } from "./api.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("api client", () => {
	test("serializes authenticated requests and query parameters", async () => {
		let request: { url: string; init: RequestInit } | undefined;
		globalThis.fetch = Object.assign(
			async (input: string | URL | Request, init: RequestInit | undefined) => {
				request = { url: String(input), init: init ?? {} };
				return new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			},
			{ preconnect: originalFetch.preconnect },
		);

		const response = await new DyngjaClient({
			baseUrl: "https://example.test",
			token: "secret",
		}).request("/api/v3/transactions/", {
			method: "POST",
			query: { count: 2 },
			body: { rate: 10, units: 3 },
		});

		expect(response).toEqual({ ok: true });
		expect(request?.url).toBe("https://example.test/api/v3/transactions/?count=2");
		expect(request?.init.method).toBe("POST");
		expect(new Headers(request?.init.headers).get("authorization")).toBe("Token secret");
		expect(JSON.parse(String(request?.init.body))).toEqual({ rate: 10, units: 3 });
	});

	test("keeps structured API errors available to callers", async () => {
		globalThis.fetch = Object.assign(
			async () => new Response(JSON.stringify({ type: "MARKET_CLOSED" }), { status: 400 }),
			{ preconnect: originalFetch.preconnect },
		);
		await expect(
			new DyngjaClient({ baseUrl: "https://example.test", token: "secret" }).request(
				"/api/v3/transactions/",
				{
					method: "POST",
				},
			),
		).rejects.toMatchObject({ status: 400, details: { type: "MARKET_CLOSED" } });
	});
});
