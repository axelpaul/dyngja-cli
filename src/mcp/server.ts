import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import pkg from "../../package.json" with { type: "json" };
import { ApiError, AuthError } from "../lib/api.ts";
import {
	normalizeAppInfo,
	normalizeOwnerships,
	normalizeStocks,
	normalizeTransactions,
	normalizeUser,
} from "../lib/normalize.ts";
import {
	buildProfilePatch,
	CONTEST_READ_KINDS,
	EDUCATION_READ_KINDS,
	fetchContests,
	fetchEducation,
	fetchHistory,
	fetchPortfolio,
	fetchUsers,
	HISTORY_KINDS,
	USER_READ_KINDS,
	updateProfile,
} from "../lib/queries.ts";
import { publicClient, sessionClient } from "../lib/session.ts";
import { placeMarketOrder } from "../lib/trade.ts";

export const WRITES_ENV_VAR = "DYNGJA_MCP_ENABLE_WRITES";

export function writesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	return env[WRITES_ENV_VAR] === "1";
}

const ok = (data: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

const fail = (value: unknown) => {
	let text = value instanceof Error ? value.message : String(value);
	if (value instanceof AuthError)
		text = `${text} Sign in with "dyngja login" in a terminal; the MCP server reuses that session.`;
	else if (value instanceof ApiError && value.details !== null && value.details !== undefined)
		text = `${text} (HTTP ${value.status}: ${JSON.stringify(value.details)})`;
	return { isError: true, content: [{ type: "text" as const, text }] };
};

async function run(fn: () => Promise<unknown>) {
	try {
		return ok(await fn());
	} catch (error) {
		return fail(error);
	}
}

const id = z.union([z.string().min(1), z.number().int()]);
const count = z.number().int().min(1).optional();
const confirm = z
	.literal(true)
	.describe("Must be true. Confirms that this changes the signed-in Dyngja account.");
const readOnly = { readOnlyHint: true, openWorldHint: true } as const;
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: true } as const;

export function createServer(options: { enableWrites?: boolean } = {}): McpServer {
	const enableWrites = options.enableWrites ?? writesEnabled();
	const server = new McpServer({ name: "dyngja", version: pkg.version });

	// ---- Read tools -------------------------------------------------------

	server.registerTool(
		"market_info",
		{
			description:
				"Dyngja app settings: whether market data is delayed and the sale commission. No login needed. (CLI: dyngja market info / dyngja info)",
			inputSchema: {},
			annotations: readOnly,
		},
		() => run(async () => normalizeAppInfo(await publicClient().getAppInfo())),
	);

	server.registerTool(
		"ads",
		{
			description: "Current in-app advertisements. No login needed. (CLI: dyngja ads)",
			inputSchema: {},
			annotations: readOnly,
		},
		() => run(() => publicClient().getAds()),
	);

	server.registerTool(
		"whoami",
		{
			description:
				"The signed-in user: id, email, name and main virtual business account (id, balance, transaction count). (CLI: dyngja whoami / profile show)",
			inputSchema: {},
			annotations: readOnly,
		},
		() => run(async () => normalizeUser(await sessionClient().getMe())),
	);

	server.registerTool(
		"business_account",
		{
			description:
				"Raw details of the signed-in user's virtual business account. (CLI: dyngja account business-account)",
			inputSchema: {},
			annotations: readOnly,
		},
		() => run(() => sessionClient().getBusinessAccount()),
	);

	server.registerTool(
		"stocks",
		{
			description:
				"Tradable stocks on the simulated Icelandic market with ticker, name and price. (CLI: dyngja market stocks)",
			inputSchema: {},
			annotations: readOnly,
		},
		() => run(async () => normalizeStocks(await sessionClient().getStocks())),
	);

	server.registerTool(
		"portfolio",
		{
			description:
				"Virtual portfolio holdings (ticker, units, average rate, market value, profit). Defaults to the signed-in account. (CLI: dyngja portfolio)",
			inputSchema: {
				business_account_id: z.string().optional().describe("Business account to inspect."),
				user_id: z.string().optional().describe("Another user's id."),
				contest_id: z.string().optional().describe("Limit to a contest."),
				count: count.describe("Maximum number of holdings."),
				sort: z.string().optional().describe("Sort type passed to the API (sortType)."),
			},
			annotations: readOnly,
		},
		(input) =>
			run(async () =>
				normalizeOwnerships(
					await fetchPortfolio(sessionClient(), {
						businessAccountId: input.business_account_id,
						userId: input.user_id,
						contestId: input.contest_id,
						count: input.count,
						sort: input.sort,
					}),
				),
			),
	);

	server.registerTool(
		"transactions",
		{
			description:
				"Recent virtual buy/sell transactions on the signed-in account. (CLI: dyngja transactions)",
			inputSchema: { count: count.describe("Number of transactions to return.") },
			annotations: readOnly,
		},
		({ count }) =>
			run(async () => normalizeTransactions(await sessionClient().getTransactions(count))),
	);

	server.registerTool(
		"history",
		{
			description:
				"Activity and performance feeds. kind: recent (normalized), recent-account (needs business_account_id), buy/sell (recent multi-user feed), sales, purchases, sales-by-id/purchases-by-id (need id), historic (optional type, stock_type), total (optional type), yesterday (optional business_account_id). (CLI: dyngja history <kind>)",
			inputSchema: {
				kind: z.enum(HISTORY_KINDS),
				count,
				id: id.optional(),
				business_account_id: z.string().optional(),
				type: z.string().optional(),
				stock_type: z.string().optional(),
			},
			annotations: readOnly,
		},
		(input) =>
			run(async () => {
				const raw = await fetchHistory(sessionClient(), input.kind, {
					count: input.count,
					id: input.id,
					businessAccountId: input.business_account_id,
					type: input.type,
					stockType: input.stock_type,
				});
				return input.kind === "recent" ? normalizeTransactions(raw) : raw;
			}),
	);

	server.registerTool(
		"contests",
		{
			description:
				"Contests. kind: list (your contests), random, search (needs query), get / participants / team-statistics (need id), invites. (CLI: dyngja contests <kind>)",
			inputSchema: {
				kind: z.enum(CONTEST_READ_KINDS),
				count,
				query: z.string().optional(),
				id: id.optional().describe("Contest id."),
			},
			annotations: readOnly,
		},
		(input) =>
			run(() =>
				fetchContests(sessionClient(), input.kind, {
					count: input.count,
					query: input.query,
					id: input.id,
				}),
			),
	);

	server.registerTool(
		"users",
		{
			description:
				"Other investors. kind: search (needs query), most-followed (user_id, defaults to you), most-profited (optional query), news-feed (optional user_id), team-statistics. (CLI: dyngja users <kind>)",
			inputSchema: {
				kind: z.enum(USER_READ_KINDS),
				query: z.string().optional(),
				user_id: id.optional(),
			},
			annotations: readOnly,
		},
		(input) =>
			run(() =>
				fetchUsers(sessionClient(), input.kind, { query: input.query, userId: input.user_id }),
			),
	);

	server.registerTool(
		"education",
		{
			description:
				"Learning content. kind: chapters, progress (yours), achievements (yours), videos. (CLI: dyngja education <kind>)",
			inputSchema: { kind: z.enum(EDUCATION_READ_KINDS) },
			annotations: readOnly,
		},
		({ kind }) => run(() => fetchEducation(sessionClient(), kind)),
	);

	server.registerTool(
		"contest_ownership_totals",
		{
			description:
				"Aggregated holdings across business accounts in a contest. (CLI: dyngja analytics contest-ownerships)",
			inputSchema: {
				business_account_ids: z.array(id).min(1),
				count,
			},
			annotations: readOnly,
		},
		(input) =>
			run(() => sessionClient().getContestOwnershipTotals(input.business_account_ids, input.count)),
	);

	server.registerTool(
		"contest_position",
		{
			description:
				"A user's position in a contest. The request body is passed through as-is. (CLI: dyngja analytics position --data)",
			inputSchema: {
				data: z.record(z.string(), z.unknown()).describe("JSON body for the position request."),
			},
			annotations: readOnly,
		},
		({ data }) => run(() => sessionClient().getUserPositionInContest(data)),
	);

	if (!enableWrites) return server;

	// ---- Write tools (DYNGJA_MCP_ENABLE_WRITES=1 and confirm: true) -------

	server.registerTool(
		"trade",
		{
			description:
				"Place a virtual (play-money) market order on the simulated market. Uses the signed-in user's main business account unless business_account_id is given. (CLI: dyngja buy|sell --yes)",
			inputSchema: {
				action: z.enum(["buy", "sell"]),
				ticker: z.string().min(1).describe("Stock ticker, e.g. MAREL."),
				units: z.number().positive(),
				business_account_id: z.string().optional(),
				confirm,
			},
			annotations: write,
		},
		(input) =>
			run(() =>
				placeMarketOrder(sessionClient(), {
					type: input.action,
					symbol: input.ticker,
					units: input.units,
					businessAccountId: input.business_account_id,
				}),
			),
	);

	server.registerTool(
		"follow_user",
		{
			description: "Follow or unfollow another user. (CLI: dyngja users follow|unfollow --yes)",
			inputSchema: { action: z.enum(["follow", "unfollow"]), user_id: id, confirm },
			annotations: write,
		},
		(input) => run(() => sessionClient().followAction(input.action, { user_id: input.user_id })),
	);

	server.registerTool(
		"join_contest",
		{
			description:
				"Join a contest by PIN (pin) or join a contest team (team_id). (CLI: dyngja contests join-pin|team-join --yes)",
			inputSchema: {
				action: z.enum(["join-pin", "team-join"]),
				pin: z.string().optional().describe("Contest PIN, for join-pin."),
				team_id: id.optional().describe("Team id, for team-join."),
				confirm,
			},
			annotations: write,
		},
		(input) =>
			run(async () => {
				if (input.action === "join-pin") {
					if (!input.pin) throw new Error("pin is required for join-pin.");
					return sessionClient().contestAction("join-pin", { pin: input.pin });
				}
				if (input.team_id === undefined) throw new Error("team_id is required for team-join.");
				return sessionClient().contestAction("team-join", { team_id: input.team_id });
			}),
	);

	server.registerTool(
		"update_education_progress",
		{
			description:
				"Record education progress for a chapter. (CLI: dyngja education update --chapter-id --yes)",
			inputSchema: {
				chapter_id: id.optional(),
				data: z
					.record(z.string(), z.unknown())
					.optional()
					.describe("Raw request body; overrides chapter_id."),
				confirm,
			},
			annotations: write,
		},
		(input) =>
			run(async () => {
				const body =
					input.data ?? (input.chapter_id === undefined ? {} : { chapter_id: input.chapter_id });
				if (Object.keys(body).length === 0) throw new Error("Provide chapter_id or data.");
				return sessionClient().updateEducationalProgress(body);
			}),
	);

	server.registerTool(
		"update_profile",
		{
			description:
				"Update the signed-in user's display name and notification/search settings. (CLI: dyngja profile update|notifications --yes)",
			inputSchema: {
				name: z.string().min(1).optional(),
				daily_notifications: z.boolean().optional(),
				other_notifications: z.boolean().optional(),
				show_in_search: z.boolean().optional(),
				data: z
					.record(z.string(), z.unknown())
					.optional()
					.describe("Extra raw fields merged into the PATCH body."),
				confirm,
			},
			annotations: write,
		},
		(input) =>
			run(async () => {
				const body = buildProfilePatch({
					name: input.name,
					dailyNotifications: input.daily_notifications,
					otherNotifications: input.other_notifications,
					showInSearch: input.show_in_search,
					data: input.data,
				});
				if (Object.keys(body).length === 0) throw new Error("Provide at least one field.");
				return updateProfile(sessionClient(), body);
			}),
	);

	server.registerTool(
		"send_feedback",
		{
			description:
				"Send feedback or a message to the Dyngja team. (CLI: dyngja profile feedback|message --text --yes)",
			inputSchema: {
				kind: z.enum(["feedback", "message"]),
				text: z.string().min(1),
				confirm,
			},
			annotations: write,
		},
		(input) => run(() => sessionClient().profilePost(input.kind, { message: input.text })),
	);

	server.registerTool(
		"patch_business_account",
		{
			description:
				"Change fields on the signed-in user's virtual business account. The body is passed through as-is. (CLI: dyngja account patch-business-account --data --yes)",
			inputSchema: { data: z.record(z.string(), z.unknown()), confirm },
			annotations: write,
		},
		({ data }) => run(() => sessionClient().accountAction("patch-business-account", data)),
	);

	server.registerTool(
		"reset_account",
		{
			description:
				"Reset the signed-in user's virtual play-money account using the app's reset endpoint (starts the account over). Cannot be undone. (CLI: dyngja account reset --yes)",
			inputSchema: { confirm },
			annotations: { ...write, destructiveHint: true },
		},
		() => run(() => sessionClient().accountAction("reset", {})),
	);

	return server;
}

export async function serve(): Promise<void> {
	const server = createServer();
	await server.connect(new StdioServerTransport());
	console.error(
		`dyngja MCP server ${pkg.version} on stdio (writes ${writesEnabled() ? "enabled" : `disabled; set ${WRITES_ENV_VAR}=1 to enable`})`,
	);
}
