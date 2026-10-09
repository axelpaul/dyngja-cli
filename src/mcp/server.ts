import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { authedClient } from "../lib/session.ts";

const server = new McpServer({ name: "dyngja", version: "0.2.0" });
const result = (data: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(data) }],
});
const error = (value: unknown) => ({
	isError: true,
	content: [
		{
			type: "text" as const,
			text: value instanceof Error ? value.message : "Dyngja lookup failed.",
		},
	],
});

server.registerTool(
	"portfolio",
	{
		description: "Read the signed-in virtual portfolio holdings. No trades or account changes.",
		inputSchema: {},
	},
	async () => {
		try {
			return result(await authedClient(true).getOwnerships());
		} catch (e) {
			return error(e);
		}
	},
);

server.registerTool(
	"transactions",
	{
		description: "Read recent virtual transactions, at most 50. No trades or account changes.",
		inputSchema: { count: z.number().int().min(1).max(50).default(10) },
	},
	async ({ count }) => {
		try {
			return result(await authedClient(true).getTransactions(count));
		} catch (e) {
			return error(e);
		}
	},
);

export async function serve(): Promise<void> {
	await server.connect(new StdioServerTransport());
}
