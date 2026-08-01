import { DyngjaClient } from "../lib/api.ts";
import {
	booleanFlag,
	integerValue,
	parseJson,
	parseJsonObject,
	printData,
	requireMutationConfirmation,
	scalarValue,
	textFlag,
} from "../lib/command.ts";
import {
	normalizeAppInfo,
	normalizeStocks,
	normalizeTransactions,
	normalizeUser,
} from "../lib/normalize.ts";
import { die, isJsonMode, printJson } from "../lib/output.ts";
import { authedClient } from "../lib/session.ts";
import { loadAuth, loadConfig } from "../lib/storage.ts";
import type { CommandFlags, JsonObject } from "../lib/types.ts";

export interface FeatureFlags extends CommandFlags {
	subcommand?: string;
	positionals?: string[];
	[key: string]: unknown;
}

function actionOf(flags: FeatureFlags, fallback: string): string {
	return flags.subcommand ?? flags.positionals?.[0] ?? fallback;
}

function countOf(flags: FeatureFlags, json: boolean): number | undefined {
	const value = textFlag(flags, "count");
	return value === undefined ? undefined : integerValue(value, "count", json);
}

function idOf(flags: FeatureFlags, name: string, json: boolean): string | number {
	const value = textFlag(flags, name);
	if (!value) die(`Provide --${name}.`, 64, json);
	return scalarValue(value);
}

function bodyOf(flags: FeatureFlags, json: boolean, defaults: JsonObject = {}): JsonObject {
	const value = textFlag(flags, "data");
	return value === undefined ? defaults : parseJsonObject(value, "data", json);
}

async function ownUserId(json: boolean): Promise<number> {
	const user = normalizeUser(await authedClient(json).getMe());
	if (user.id === null) die("Dyngja did not return a user id.", 1, json);
	return user.id;
}

export async function marketCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const action = actionOf(flags, "info");
	const publicClient = new DyngjaClient({ baseUrl: loadConfig().baseUrl });
	if (action === "info") {
		const raw = await publicClient.getAppInfo();
		printData(raw, flags, flags.raw ? raw : normalizeAppInfo(raw));
		return;
	}
	if (action === "root") {
		printData(await publicClient.getApiRoot(), flags);
		return;
	}
	if (action === "stocks") {
		const raw = await authedClient(json).getStocks();
		printData(raw, flags, flags.raw ? raw : normalizeStocks(raw));
		return;
	}
	die(`Unknown market action "${action}". Use info, root, or stocks.`, 64, json);
}

export async function adsCommand(flags: FeatureFlags): Promise<void> {
	const raw = await new DyngjaClient({ baseUrl: loadConfig().baseUrl }).getAds();
	printData(raw, flags);
}

export async function historyCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const action = actionOf(flags, "recent");
	const client = authedClient(json);
	const count = countOf(flags, json);
	let raw: unknown;
	switch (action) {
		case "recent":
			raw = await client.getRecentTransactions(count);
			break;
		case "recent-account":
			raw = await client.getRecentTransactionsByBusinessAccountId(
				String(idOf(flags, "business-account-id", json)),
				count,
			);
			break;
		case "buy":
		case "sell":
			raw = await client.getRecentMultiple(action, count);
			break;
		case "sales":
			raw = await client.getSalesLazy(count);
			break;
		case "purchases":
			raw = await client.getPurchasesLazy(count);
			break;
		case "sales-by-id":
			raw = await client.getSalesLazyFromId(idOf(flags, "id", json), count);
			break;
		case "purchases-by-id":
			raw = await client.getPurchasesLazyFromId(idOf(flags, "id", json), count);
			break;
		case "historic":
			raw = await client.getHistoricData(textFlag(flags, "type"), textFlag(flags, "stock-type"));
			break;
		case "total":
			raw = await client.getTotalHistoryData(textFlag(flags, "type"));
			break;
		case "yesterday":
			raw = await client.getYesterdaysTotal(textFlag(flags, "business-account-id"));
			break;
		default:
			die(`Unknown history action "${action}".`, 64, json);
	}
	printData(raw, flags, action === "recent" ? normalizeTransactions(raw) : raw);
}

export async function usersCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const action = actionOf(flags, "search");
	const client = authedClient(json);
	if (action === "search") {
		const query = textFlag(flags, "query") ?? flags.positionals?.[1];
		if (!query) die("Provide --query.", 64, json);
		printData(await client.getUsersByQuery(query), flags);
		return;
	}
	if (action === "most-followed") {
		const id = textFlag(flags, "user-id") ?? String(await ownUserId(json));
		printData(await client.getMostFollowedUsers(id), flags);
		return;
	}
	if (action === "most-profited") {
		const query = textFlag(flags, "query");
		printData(await client.getMostProfitedUsers(query ? { query } : undefined), flags);
		return;
	}
	if (action === "news-feed") {
		printData(await client.getNewsFeed(textFlag(flags, "user-id")), flags);
		return;
	}
	if (action === "team-statistics") {
		printData(await client.getTeamStatistics(), flags);
		return;
	}
	if (action === "follow" || action === "unfollow") {
		const target = idOf(flags, "user-id", json);
		const payload = bodyOf(flags, json, { user_id: target });
		requireMutationConfirmation(
			flags,
			`${action === "follow" ? "Following" : "Unfollowing"} a user`,
			json,
		);
		if (flags.dryRun) {
			printJson({ action, request: payload, dry_run: true });
			return;
		}
		const path = action === "follow" ? "/api/v3/follow/" : "/api/v3/unfollow/";
		const response = await client.postSelf(path, payload);
		printData(response, flags, { action, request: payload, response });
		return;
	}
	die(`Unknown users action "${action}".`, 64, json);
}

export async function contestsCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const action = actionOf(flags, "list");
	const client = authedClient(json);
	const count = countOf(flags, json);
	if (action === "list") {
		printData(await client.getUserContests(count === undefined ? undefined : { count }), flags);
		return;
	}
	if (action === "random") {
		printData(await client.getRandomContests(count === undefined ? undefined : { count }), flags);
		return;
	}
	if (action === "search") {
		const query = textFlag(flags, "query");
		if (!query) die("Provide --query.", 64, json);
		printData(
			await client.searchContests({ query, ...(count === undefined ? {} : { count }) }),
			flags,
		);
		return;
	}
	if (action === "get") {
		printData(await client.getContestById(idOf(flags, "id", json)), flags);
		return;
	}
	if (action === "participants") {
		printData(await client.getContestParticipants({ contest_id: idOf(flags, "id", json) }), flags);
		return;
	}
	if (action === "invites") {
		printData(await client.getInvites(), flags);
		return;
	}
	if (action === "team-statistics") {
		printData(await client.getTeamStatistics({ contest_id: idOf(flags, "id", json) }), flags);
		return;
	}

	const endpoint: Record<string, string> = {
		join: "/api/v3/contests/",
		"join-pin": "/api/v3/contests/join/",
		leave: "/api/v3/contests/",
		"team-join": "/api/v3/contests/jointeam/",
		"accept-invite": "/api/v3/contests/",
		"delete-invite": "/api/v3/contests/",
	};
	if (!endpoint[action]) die(`Unknown contests action "${action}".`, 64, json);
	const defaults: Record<string, JsonObject> = {
		join: { contest_id: idOf(flags, "id", json) },
		"join-pin": { pin: textFlag(flags, "pin") ?? "" },
		leave: { contest_id: idOf(flags, "id", json) },
		"team-join": { team_id: idOf(flags, "team-id", json) },
		"accept-invite": { invite_id: idOf(flags, "invite-id", json) },
		"delete-invite": { invite_id: idOf(flags, "invite-id", json) },
	};
	const payload = bodyOf(flags, json, defaults[action] ?? {});
	requireMutationConfirmation(flags, `Contest action "${action}"`, json);
	if (flags.dryRun) {
		printJson({ action, path: endpoint[action], request: payload, dry_run: true });
		return;
	}
	const response = await client.contestAction(endpoint[action] as string, payload);
	printData(response, flags, { action, request: payload, response });
}

export async function educationCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const action = actionOf(flags, "chapters");
	const client = authedClient(json);
	if (action === "chapters") {
		printData(await client.getChapters(), flags);
		return;
	}
	if (action === "progress") {
		printData(await client.getEducationalProgress(), flags);
		return;
	}
	if (action === "achievements") {
		printData(await client.getAchievements(), flags);
		return;
	}
	if (action === "videos") {
		printData(await client.getVideos(), flags);
		return;
	}
	if (action === "update") {
		const chapterId = textFlag(flags, "chapter-id");
		const payload = bodyOf(flags, json, chapterId ? { chapter_id: scalarValue(chapterId) } : {});
		if (Object.keys(payload).length === 0) die("Provide --data or --chapter-id.", 64, json);
		requireMutationConfirmation(flags, "Updating education progress", json);
		if (flags.dryRun) {
			printJson({ action, request: payload, dry_run: true });
			return;
		}
		const response = await client.postSelf(
			"/api/v3/users/self/update_educational_progress/",
			payload,
		);
		printData(response, flags, { action, request: payload, response });
		return;
	}
	die(`Unknown education action "${action}".`, 64, json);
}

export async function profileCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const action = actionOf(flags, "show");
	const client = authedClient(json);
	if (action === "show") {
		const raw = await client.getMe();
		printData(raw, flags, flags.raw ? raw : normalizeUser(raw));
		return;
	}
	if (action === "update" || action === "notifications") {
		const current = normalizeUser(await client.getMe());
		if (current.id === null) die("Dyngja did not return a user id.", 1, json);
		const dataValue = textFlag(flags, "data");
		const data = dataValue ? parseJsonObject(dataValue, "data", json) : {};
		const profile: JsonObject =
			typeof data.profile === "object" && data.profile !== null ? (data.profile as JsonObject) : {};
		const name = textFlag(flags, "name");
		if (name) data.last_name = name;
		for (const [flagName, field] of [
			["daily-notifications", "daily_notifications"],
			["other-notifications", "other_notifications"],
			["show-in-search", "show_in_search"],
		] as const) {
			const value = booleanFlag(flags, flagName, json);
			if (value !== undefined) profile[field] = value;
		}
		if (Object.keys(profile).length > 0) data.profile = profile;
		if (Object.keys(data).length === 0) die("Provide profile fields or --data.", 64, json);
		requireMutationConfirmation(flags, "Updating your profile", json);
		if (flags.dryRun) {
			printJson({ action, request: data, dry_run: true });
			return;
		}
		const response = await client.patchUser(current.id, data);
		printData(response, flags, { action, request: data, response });
		return;
	}
	if (action === "feedback" || action === "message" || action === "picture") {
		const text = textFlag(flags, "text");
		const payload = bodyOf(flags, json, text ? { message: text } : {});
		if (Object.keys(payload).length === 0) die("Provide --data or --text.", 64, json);
		requireMutationConfirmation(flags, `Sending ${action}`, json);
		if (flags.dryRun) {
			printJson({ action, request: payload, dry_run: true });
			return;
		}
		const path =
			action === "feedback"
				? "/api/v3/feedback/"
				: action === "message"
					? "/api/v3/message/"
					: "/api/v3/upload_image/";
		const response = await client.postSelf(path, payload);
		printData(response, flags, { action, request: payload, response });
		return;
	}
	die(`Unknown profile action "${action}".`, 64, json);
}

export async function accountCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const action = actionOf(flags, "show");
	const client = authedClient(json);
	if (action === "show") {
		const raw = await client.getMe();
		printData(raw, flags, flags.raw ? raw : normalizeUser(raw));
		return;
	}
	if (action === "business-account") {
		printData(await client.getBusinessAccount(), flags);
		return;
	}
	if (action === "patch-business-account" || action === "device-token" || action === "reset") {
		const token = textFlag(flags, "token");
		const payload = bodyOf(flags, json, action === "device-token" && token ? { token } : {});
		requireMutationConfirmation(
			flags,
			action === "reset" ? "Resetting your account" : `Account action "${action}"`,
			json,
		);
		if (flags.dryRun) {
			printJson({ action, request: payload, dry_run: true });
			return;
		}
		const path =
			action === "patch-business-account"
				? "/api/v3/users/self/business_account_patch/"
				: action === "device-token"
					? "/api/v3/users/self/push_token/"
					: "/api/v3/users/self/reset_account/";
		const response = await client.postSelf(path, payload);
		printData(response, flags, { action, request: payload, response });
		return;
	}
	die(`Unknown account action "${action}".`, 64, json);
}

export async function analyticsCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const action = actionOf(flags, "contest-ownerships");
	const client = authedClient(json);
	if (action === "contest-ownerships") {
		const ids = textFlag(flags, "business-account-ids");
		if (!ids) die("Provide --business-account-ids as comma-separated IDs.", 64, json);
		const accountIds = ids
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean)
			.map(scalarValue);
		printData(await client.getContestOwnershipTotals(accountIds, countOf(flags, json)), flags);
		return;
	}
	if (action === "position") {
		const payload = bodyOf(flags, json);
		if (Object.keys(payload).length === 0)
			die("Provide --data for the position request.", 64, json);
		printData(await client.getUserPositionInContest(payload), flags);
		return;
	}
	die(`Unknown analytics action "${action}".`, 64, json);
}

export async function apiCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const path = textFlag(flags, "path") ?? flags.positionals?.[0];
	if (!path) die("Provide an API path, e.g. /api/v3/transactions/.", 64, json);
	if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/http"))
		die("API paths must be relative and start with /.", 64, json);
	const method = (textFlag(flags, "method") ?? "GET").toUpperCase();
	if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(method))
		die("--method must be GET, PATCH, POST, PUT, or DELETE.", 64, json);
	const dataValue = textFlag(flags, "data");
	const payload = dataValue ? parseJson(dataValue, "data", json) : undefined;
	if (method !== "GET") requireMutationConfirmation(flags, `${method} ${path}`, json);
	if (flags.dryRun) {
		printJson({ method, path, request: payload, dry_run: true });
		return;
	}
	const auth = !hasPublicFlag(flags);
	const client = new DyngjaClient({ baseUrl: loadConfig().baseUrl, token: loadAuth()?.token });
	const response = await client.request(path, {
		method: method as "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
		auth,
		body: payload,
	});
	printData(response, flags);
}

function hasPublicFlag(flags: FeatureFlags): boolean {
	return flags.public === true || flags.public === "true" || flags.public === "1";
}
