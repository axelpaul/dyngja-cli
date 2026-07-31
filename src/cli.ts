#!/usr/bin/env bun

import { DyngjaApi, DyngjaApiError } from "./api";

const HELP = `Dyngja CLI

Usage:
  dyngja app-info
  dyngja auth login --email <email> [--password <password>]
  dyngja auth register --email <email> --password <password> [--name <name>]
  dyngja auth confirm --email <email> --code <code>
  dyngja auth resend --email <email>
  dyngja profile
  dyngja transactions list [--count <n>]
  dyngja api get <path>

Environment:
  DYNGJA_TOKEN       Token returned by auth login
  DYNGJA_EMAIL       Default email/username for auth commands
  DYNGJA_PASSWORD    Default password for auth login
  DYNGJA_API_URL     Override the API origin (default: https://dyngja.reynirf.com)

Examples:
  DYNGJA_PASSWORD='...' bun run src/cli.ts auth login --email you@example.com
  DYNGJA_TOKEN='token-from-login' bun run src/cli.ts profile
  DYNGJA_TOKEN='token-from-login' bun run src/cli.ts transactions list --count 20
`;

type Args = string[];

function option(args: Args, name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function required(value: string | undefined, description: string): string {
  if (!value) throw new Error(`Missing ${description}`);
  return value;
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function usageError(message: string): never {
  throw new Error(`${message}\n\nRun \`dyngja --help\` for usage.`);
}

async function run(args: Args): Promise<void> {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return;
  }

  const command = args[0];
  const api = new DyngjaApi();

  if (command === "app-info") {
    print(await api.appInfo());
    return;
  }

  if (command === "profile") {
    print(await api.profile());
    return;
  }

  if (command === "transactions" && args[1] === "list") {
    const query = new URLSearchParams();
    const count = option(args, "--count");
    if (count) query.set("count", count);
    print(await api.transactions(query));
    return;
  }

  if (command === "api" && args[1] === "get") {
    const path = required(args[2], "an API path");
    if (!path.startsWith("/")) usageError("The API path must start with `/`");
    print(await api.rawGet(path));
    return;
  }

  if (command === "auth") {
    const action = args[1];

    if (action === "login") {
      const username = option(args, "--email") ?? Bun.env.DYNGJA_EMAIL;
      const password = option(args, "--password") ?? Bun.env.DYNGJA_PASSWORD;
      const result = await api.login(required(username, "--email or DYNGJA_EMAIL"), required(password, "--password or DYNGJA_PASSWORD"));
      print({ ...result, hint: "Export DYNGJA_TOKEN with this token for subsequent commands." });
      return;
    }

    if (action === "register") {
      const email = required(option(args, "--email") ?? Bun.env.DYNGJA_EMAIL, "--email or DYNGJA_EMAIL");
      const password = required(option(args, "--password") ?? Bun.env.DYNGJA_PASSWORD, "--password or DYNGJA_PASSWORD");
      print(await api.register({ email, password, name: option(args, "--name") }));
      return;
    }

    if (action === "confirm") {
      const email = required(option(args, "--email") ?? Bun.env.DYNGJA_EMAIL, "--email or DYNGJA_EMAIL");
      const code = required(option(args, "--code"), "--code");
      print(await api.confirmAccount(email, code));
      return;
    }

    if (action === "resend") {
      const email = required(option(args, "--email") ?? Bun.env.DYNGJA_EMAIL, "--email or DYNGJA_EMAIL");
      print(await api.resendConfirmation(email));
      return;
    }
  }

  usageError(`Unknown command: ${args.join(" ")}`);
}

try {
  await run(process.argv.slice(2));
} catch (error) {
  if (error instanceof DyngjaApiError) {
    console.error(JSON.stringify({ error: error.message, status: error.status, details: error.details }, null, 2));
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
