/**
 * Read queries shared by the CLI commands and the MCP server, so both call the
 * same client methods with the same parameters.
 */
import type { DyngjaClient } from "./api.ts";
import { normalizeUser } from "./normalize.ts";
import type { JsonObject } from "./types.ts";

export class MissingInputError extends Error {
	readonly input: string;
	constructor(input: string) {
		super(`Missing required input: ${input}.`);
		this.name = "MissingInputError";
		this.input = input;
	}
}

function required<T>(value: T | undefined, input: string): T {
	if (value === undefined || value === null || value === "") throw new MissingInputError(input);
	return value;
}

export const HISTORY_KINDS = [
	"recent",
	"recent-account",
	"buy",
	"sell",
	"sales",
	"purchases",
	"sales-by-id",
	"purchases-by-id",
	"historic",
	"total",
	"yesterday",
] as const;
export type HistoryKind = (typeof HISTORY_KINDS)[number];

export interface HistoryOptions {
	count?: number;
	id?: string | number;
	businessAccountId?: string;
	type?: string;
	stockType?: string;
}

export function fetchHistory(
	client: DyngjaClient,
	kind: HistoryKind,
	options: HistoryOptions = {},
): Promise<unknown> {
	const { count } = options;
	switch (kind) {
		case "recent":
			return client.getRecentTransactions(count);
		case "recent-account":
			return client.getRecentTransactionsByBusinessAccountId(
				required(options.businessAccountId, "business_account_id"),
				count,
			);
		case "buy":
		case "sell":
			return client.getRecentMultiple(kind, count);
		case "sales":
			return client.getSalesLazy(count);
		case "purchases":
			return client.getPurchasesLazy(count);
		case "sales-by-id":
			return client.getSalesLazyFromId(required(options.id, "id"), count);
		case "purchases-by-id":
			return client.getPurchasesLazyFromId(required(options.id, "id"), count);
		case "historic":
			return client.getHistoricData(options.type, options.stockType);
		case "total":
			return client.getTotalHistoryData(options.type);
		case "yesterday":
			return client.getYesterdaysTotal(options.businessAccountId);
	}
}

export const CONTEST_READ_KINDS = [
	"list",
	"random",
	"search",
	"get",
	"participants",
	"invites",
	"team-statistics",
] as const;
export type ContestReadKind = (typeof CONTEST_READ_KINDS)[number];

export interface ContestReadOptions {
	count?: number;
	query?: string;
	id?: string | number;
}

export function fetchContests(
	client: DyngjaClient,
	kind: ContestReadKind,
	options: ContestReadOptions = {},
): Promise<unknown> {
	const countQuery = options.count === undefined ? {} : { count: options.count };
	switch (kind) {
		case "list":
			return client.getUserContests(options.count === undefined ? undefined : countQuery);
		case "random":
			return client.getRandomContests(options.count === undefined ? undefined : countQuery);
		case "search":
			return client.searchContests({ query: required(options.query, "query"), ...countQuery });
		case "get":
			return client.getContestById(required(options.id, "id"));
		case "participants":
			return client.getContestParticipants({ contest_id: required(options.id, "id") });
		case "invites":
			return client.getInvites();
		case "team-statistics":
			return client.getTeamStatistics({ contest_id: required(options.id, "id") });
	}
}

export const USER_READ_KINDS = [
	"search",
	"most-followed",
	"most-profited",
	"news-feed",
	"team-statistics",
] as const;
export type UserReadKind = (typeof USER_READ_KINDS)[number];

export interface UserReadOptions {
	query?: string;
	userId?: string | number;
}

export async function fetchUsers(
	client: DyngjaClient,
	kind: UserReadKind,
	options: UserReadOptions = {},
): Promise<unknown> {
	switch (kind) {
		case "search":
			return client.getUsersByQuery(required(options.query, "query"));
		case "most-followed": {
			let userId = options.userId;
			if (userId === undefined) {
				const me = normalizeUser(await client.getMe());
				if (me.id === null) throw new Error("Dyngja did not return a user id.");
				userId = me.id;
			}
			return client.getMostFollowedUsers(userId);
		}
		case "most-profited":
			return client.getMostProfitedUsers(options.query ? { query: options.query } : undefined);
		case "news-feed":
			return client.getNewsFeed(options.userId);
		case "team-statistics":
			return client.getTeamStatistics();
	}
}

export const EDUCATION_READ_KINDS = ["chapters", "progress", "achievements", "videos"] as const;
export type EducationReadKind = (typeof EDUCATION_READ_KINDS)[number];

export function fetchEducation(client: DyngjaClient, kind: EducationReadKind): Promise<unknown> {
	switch (kind) {
		case "chapters":
			return client.getChapters();
		case "progress":
			return client.getEducationalProgress();
		case "achievements":
			return client.getAchievements();
		case "videos":
			return client.getVideos();
	}
}

export interface PortfolioOptions {
	businessAccountId?: string;
	userId?: string;
	contestId?: string;
	count?: number | string;
	sort?: string;
}

export function fetchPortfolio(client: DyngjaClient, options: PortfolioOptions = {}) {
	return client.getOwnerships({
		...(options.businessAccountId ? { business_account_id: options.businessAccountId } : {}),
		...(options.userId ? { user_id: options.userId } : {}),
		...(options.contestId ? { contest_id: options.contestId } : {}),
		...(options.count !== undefined && options.count !== "" ? { count: options.count } : {}),
		...(options.sort ? { sortType: options.sort } : {}),
	});
}

export interface ProfileChanges {
	name?: string;
	dailyNotifications?: boolean;
	otherNotifications?: boolean;
	showInSearch?: boolean;
	data?: JsonObject;
}

/** Build the PATCH body for /api/v3/users/<id>/ from convenience fields and raw data. */
export function buildProfilePatch(changes: ProfileChanges): JsonObject {
	const data: JsonObject = { ...(changes.data ?? {}) };
	const profile: JsonObject =
		typeof data.profile === "object" && data.profile !== null
			? { ...(data.profile as JsonObject) }
			: {};
	if (changes.name) data.last_name = changes.name;
	if (changes.dailyNotifications !== undefined)
		profile.daily_notifications = changes.dailyNotifications;
	if (changes.otherNotifications !== undefined)
		profile.other_notifications = changes.otherNotifications;
	if (changes.showInSearch !== undefined) profile.show_in_search = changes.showInSearch;
	if (Object.keys(profile).length > 0) data.profile = profile;
	return data;
}

/** Update the signed-in user's profile. */
export async function updateProfile(client: DyngjaClient, data: JsonObject) {
	const current = normalizeUser(await client.getMe());
	if (current.id === null) throw new Error("Dyngja did not return a user id.");
	return client.patchUser(current.id, data);
}
