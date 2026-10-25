import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const READ_TOOLS = [
	"ads",
	"business_account",
	"contest_ownership_totals",
	"contest_position",
	"contests",
	"education",
	"history",
	"market_info",
	"portfolio",
	"stocks",
	"transactions",
	"users",
	"whoami",
];
const WRITE_TOOLS = [
	"follow_user",
	"join_contest",
	"patch_business_account",
	"reset_account",
	"send_feedback",
	"trade",
	"update_education_progress",
	"update_profile",
];

const configDir = mkdtempSync(join(tmpdir(), "dyngja-mcp-test-"));
const originalFetch = globalThis.fetch;
const requests: Array<{ url: string; method: string; body: unknown }> = [];

// Set before server.ts (and storage.ts) are imported below.
process.env.DYNGJA_CONFIG_DIR = configDir;
process.env.DYNGJA_API_URL = "https://example.test";

beforeAll(() => {
	writeFileSync(
		join(configDir, "auth.json"),
		JSON.stringify({ token: "test-token", user: null, loggedInAt: "2026-01-01T00:00:00Z" }),
	);
});

afterAll(() => rmSync(configDir, { recursive: true, force: true }));
afterEach(() => {
	globalThis.fetch = originalFetch;
	requests.length = 0;
});

function mockFetch(respond: (url: string) => unknown) {
	globalThis.fetch = Object.assign(
		async (input: string | URL | Request, init: RequestInit | undefined) => {
			const url = String(input);
			requests.push({
				url,
				method: init?.method ?? "GET",
				body: init?.body ? JSON.parse(String(init.body)) : undefined,
			});
			return new Response(JSON.stringify(respond(url)), { status: 200 });
		},
		{ preconnect: originalFetch.preconnect },
	);
}

async function connect(enableWrites: boolean) {
	const { createServer } = await import("./server.ts");
	const server = createServer({ enableWrites });
	const client = new Client({ name: "dyngja-test", version: "0.0.0" });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
	return client;
}

describe("dyngja MCP server", () => {
	test("hides write tools unless writes are enabled", async () => {
		const client = await connect(false);
		const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
		expect(names).toEqual(READ_TOOLS);
		await client.close();
	});

	test("lists write tools when writes are enabled", async () => {
		const client = await connect(true);
		const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
		expect(names).toEqual([...READ_TOOLS, ...WRITE_TOOLS].sort());
		await client.close();
	});

	test("read tools use the shared client and normalizers", async () => {
		mockFetch(() => ({ results: [{ id: 1, type: "buy", symbol: "MAREL", units: 2 }] }));
		const client = await connect(false);
		const result = await client.callTool({ name: "transactions", arguments: { count: 5 } });
		expect(result.isError).toBeFalsy();
		expect(requests[0]?.url).toBe("https://example.test/api/v3/transactions/?count=5");
		const text = (result.content as Array<{ text: string }>)[0]?.text ?? "";
		expect(JSON.parse(text).count).toBe(1);
		await client.close();
	});

	test("missing required inputs are reported as tool errors", async () => {
		mockFetch(() => ({}));
		const client = await connect(false);
		const result = await client.callTool({ name: "contests", arguments: { kind: "get" } });
		expect(result.isError).toBe(true);
		expect(requests).toHaveLength(0);
		await client.close();
	});

	test("trade requires confirm: true and resolves the main account", async () => {
		mockFetch((url) =>
			url.endsWith("/api/v3/users/")
				? { id: 7, main_business_account: { id: "acc-1" } }
				: { ok: true },
		);
		const client = await connect(true);
		const rejected = await client.callTool({
			name: "trade",
			arguments: { action: "buy", ticker: "MAREL", units: 1 },
		});
		expect(rejected.isError).toBe(true);
		expect(requests).toHaveLength(0);

		const placed = await client.callTool({
			name: "trade",
			arguments: { action: "buy", ticker: "MAREL", units: 3, confirm: true },
		});
		expect(placed.isError).toBeFalsy();
		const order = requests.find((request) => request.method === "POST");
		expect(order?.url).toBe("https://example.test/api/v1/transactions/");
		expect(order?.body).toEqual({
			units: 3,
			symbol: "MAREL",
			type: "buy",
			business_account_id: "acc-1",
		});
		await client.close();
	});
});

test("`dyngja serve` speaks MCP over stdio without logging to stdout", async () => {
	const client = new Client({ name: "dyngja-test", version: "0.0.0" });
	const env = { ...process.env, DYNGJA_CONFIG_DIR: configDir } as Record<string, string>;
	delete env.DYNGJA_MCP_ENABLE_WRITES;
	try {
		await client.connect(
			new StdioClientTransport({
				command: process.execPath,
				args: ["src/index.ts", "serve"],
				cwd: process.cwd(),
				env,
				stderr: "pipe",
			}),
		);
		const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
		expect(names).toEqual(READ_TOOLS);
	} finally {
		await client.close();
	}
});
