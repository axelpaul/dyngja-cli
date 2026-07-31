import { AuthError, DyngjaClient } from "../lib/api.ts";
import { color, isJsonMode, printJson } from "../lib/output.ts";
import { loadAuth, loadConfig } from "../lib/storage.ts";

type CheckStatus = "ok" | "warn" | "fail";

interface Check {
	name: string;
	status: CheckStatus;
	detail: string;
}

export async function doctorCommand(flags: { json?: boolean; pretty?: boolean }): Promise<void> {
	const json = isJsonMode(flags);
	const checks: Check[] = [];
	const client = new DyngjaClient({ baseUrl: loadConfig().baseUrl });

	try {
		await client.getAppInfo();
		checks.push({ name: "api", status: "ok", detail: "Dyngja API is reachable." });
	} catch (error) {
		checks.push({
			name: "api",
			status: "fail",
			detail: error instanceof Error ? error.message : String(error),
		});
	}

	const auth = loadAuth();
	if (!auth?.token) {
		checks.push({ name: "auth", status: "fail", detail: 'No session found. Run "dyngja login".' });
	} else {
		try {
			await new DyngjaClient({ baseUrl: loadConfig().baseUrl, token: auth.token }).getMe();
			checks.push({ name: "auth", status: "ok", detail: "Saved session accepted by Dyngja." });
		} catch (error) {
			checks.push({
				name: "auth",
				status: error instanceof AuthError ? "fail" : "warn",
				detail:
					error instanceof AuthError ? 'Session rejected. Run "dyngja login".' : String(error),
			});
		}
	}

	const overall: CheckStatus = checks.some((check) => check.status === "fail")
		? "fail"
		: checks.some((check) => check.status === "warn")
			? "warn"
			: "ok";
	if (json) {
		printJson({ status: overall, checks });
		if (overall === "fail") process.exit(2);
		return;
	}

	const icon: Record<CheckStatus, string> = {
		ok: color.green("✓"),
		warn: color.yellow("!"),
		fail: color.red("✗"),
	};
	for (const check of checks)
		console.log(`  ${icon[check.status]} ${color.bold(check.name)}  ${color.dim(check.detail)}`);
	console.log("");
	if (overall === "ok") console.log(color.green("All checks passed."));
	else if (overall === "warn") console.log(color.yellow("Some checks have warnings."));
	else {
		console.log(color.red("Checks failed."));
		process.exit(2);
	}
}
