import { CONTEST_ACTION_PATHS, type ContestAction, DyngjaClient } from "../lib/api.ts";
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
import {
	buildProfilePatch,
	CONTEST_READ_KINDS,
	type ContestReadKind,
	EDUCATION_READ_KINDS,
	type EducationReadKind,
	fetchContests,
	fetchEducation,
	fetchHistory,
	fetchUsers,
	HISTORY_KINDS,
	type HistoryKind,
	MissingInputError,
	USER_READ_KINDS,
	type UserReadKind,
	updateProfile,
} from "../lib/queries.ts";
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

function optionalId(flags: FeatureFlags, name: string): string | number | undefined {
	const value = textFlag(flags, name);
	return value === undefined ? undefined : scalarValue(value);
}

/** Run a shared query, turning a missing input into a CLI usage error. */
async function cliQuery<T>(json: boolean, run: (client: DyngjaClient) => Promise<T>): Promise<T> {
	try {
		return await run(authedClient(json));
	} catch (error) {
		if (error instanceof MissingInputError)
			die(`Provide --${error.input.replaceAll("_", "-")}.`, 64, json);
		throw error;
	}
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
	if (!(HISTORY_KINDS as readonly string[]).includes(action))
		die(`Unknown history action "${action}".`, 64, json);
	const raw = await cliQuery(json, (client) =>
		fetchHistory(client, action as HistoryKind, {
			count: countOf(flags, json),
			id: optionalId(flags, "id"),
			businessAccountId: textFlag(flags, "business-account-id"),
			type: textFlag(flags, "type"),
			stockType: textFlag(flags, "stock-type"),
		}),
	);
	printData(raw, flags, action === "recent" ? normalizeTransactions(raw) : raw);
}

export async function usersCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const action = actionOf(flags, "search");
	const client = authedClient(json);
	if ((USER_READ_KINDS as readonly string[]).includes(action)) {
		const raw = await cliQuery(json, (c) =>
			fetchUsers(c, action as UserReadKind, {
				query:
					textFlag(flags, "query") ?? (action === "search" ? flags.positionals?.[1] : undefined),
				userId: optionalId(flags, "user-id"),
			}),
		);
		printData(raw, flags);
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
		const response = await client.followAction(action, payload);
		printData(response, flags, { action, request: payload, response });
		return;
	}
	die(`Unknown users action "${action}".`, 64, json);
}

export async function contestsCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const action = actionOf(flags, "list");
	const client = authedClient(json);
	if ((CONTEST_READ_KINDS as readonly string[]).includes(action)) {
		const raw = await cliQuery(json, (c) =>
			fetchContests(c, action as ContestReadKind, {
				count: countOf(flags, json),
				query: textFlag(flags, "query"),
				id: optionalId(flags, "id"),
			}),
		);
		printData(raw, flags);
		return;
	}
	if (!Object.hasOwn(CONTEST_ACTION_PATHS, action))
		die(`Unknown contests action "${action}".`, 64, json);
	const contestAction = action as ContestAction;
	const defaults = (): JsonObject => {
		switch (contestAction) {
			case "join":
			case "leave":
				return { contest_id: idOf(flags, "id", json) };
			case "join-pin":
				return { pin: textFlag(flags, "pin") ?? "" };
			case "team-join":
				return { team_id: idOf(flags, "team-id", json) };
			case "accept-invite":
			case "delete-invite":
				return { invite_id: idOf(flags, "invite-id", json) };
		}
	};
	const payload = textFlag(flags, "data") === undefined ? defaults() : bodyOf(flags, json);
	requireMutationConfirmation(flags, `Contest action "${action}"`, json);
	if (flags.dryRun) {
		printJson({
			action,
			path: CONTEST_ACTION_PATHS[contestAction],
			request: payload,
			dry_run: true,
		});
		return;
	}
	const response = await client.contestAction(contestAction, payload);
	printData(response, flags, { action, request: payload, response });
}

export async function educationCommand(flags: FeatureFlags): Promise<void> {
	const json = isJsonMode(flags);
	const action = actionOf(flags, "chapters");
	const client = authedClient(json);
	if ((EDUCATION_READ_KINDS as readonly string[]).includes(action)) {
		printData(await fetchEducation(client, action as EducationReadKind), flags);
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
		const response = await client.updateEducationalProgress(payload);
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
		const dataValue = textFlag(flags, "data");
		const data = buildProfilePatch({
			data: dataValue ? parseJsonObject(dataValue, "data", json) : undefined,
			name: textFlag(flags, "name"),
			dailyNotifications: booleanFlag(flags, "daily-notifications", json),
			otherNotifications: booleanFlag(flags, "other-notifications", json),
			showInSearch: booleanFlag(flags, "show-in-search", json),
		});
		if (Object.keys(data).length === 0) die("Provide profile fields or --data.", 64, json);
		requireMutationConfirmation(flags, "Updating your profile", json);
		if (flags.dryRun) {
			printJson({ action, request: data, dry_run: true });
			return;
		}
		const response = await updateProfile(client, data);
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
		const response = await client.profilePost(action, payload);
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
		const response = await client.accountAction(action, payload);
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
