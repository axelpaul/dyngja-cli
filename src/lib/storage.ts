import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AuthState, UserConfig } from "./types.ts";

const configDir = process.env.DYNGJA_CONFIG_DIR ?? join(homedir(), ".config", "dyngja");
const authPath = join(configDir, "auth.json");
const configPath = join(configDir, "config.json");

function ensureDir(): void {
	if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true, mode: 0o700 });
}

function writeSecure(path: string, value: unknown): void {
	ensureDir();
	const temporaryPath = `${path}.tmp`;
	writeFileSync(temporaryPath, JSON.stringify(value, null, 2), { mode: 0o600 });
	chmodSync(temporaryPath, 0o600);
	renameSync(temporaryPath, path);
}

function readJson<T>(path: string): T | null {
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch {
		return null;
	}
}

export function saveAuth(state: AuthState): void {
	writeSecure(authPath, state);
}

export function loadAuth(): AuthState | null {
	return readJson<AuthState>(authPath);
}

export function clearAuth(): void {
	if (existsSync(authPath)) unlinkSync(authPath);
}

export function loadConfig(): UserConfig {
	return readJson<UserConfig>(configPath) ?? {};
}

export const paths = { configDir, auth: authPath, config: configPath };
