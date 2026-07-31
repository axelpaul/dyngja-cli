# dyngja-cli

Headless CLI for [Dyngja](https://dyngja.app/) — the Icelandic virtual investing app. Check your account, inspect activity, and give an AI agent a predictable interface to the simulated market without opening the mobile app.

Built with [Bun](https://bun.sh/). JSON is a first-class output mode, and the local session is stored with restrictive permissions.

## Install

Needs Bun ≥ 1.3.

```sh
git clone https://github.com/axelpaul/dyngja-cli.git
cd dyngja-cli
bun install
bun link                 # exposes `dyngja` on your PATH
dyngja login
```

Or run without linking:

```sh
bun src/index.ts <command>
```

## Auth

```sh
dyngja login                         # prompts for email and password
dyngja login --email you@example.com # prompts only for the password
dyngja whoami
dyngja logout
```

For CI and agents, use environment variables instead of putting secrets in shell history:

```sh
DYNGJA_USER=you@example.com DYNGJA_PW='your-password' dyngja login
```

The session is cached at `~/.config/dyngja/auth.json` with mode `0600`. Run `dyngja doctor` if authentication or connectivity needs checking.

## Commands

```text
dyngja login                         sign in and cache a session
dyngja logout                        clear the local session
dyngja whoami                        show the signed-in account
dyngja info                          show current app settings
dyngja transactions [--count N]      list account activity
dyngja register --email <e>          create an account
dyngja confirm --email <e> --code N  confirm an account
dyngja doctor                        check auth and API health
dyngja schema [command]              show an agent-facing response shape
dyngja version                       print the CLI version
```

## Output

| Flag | Meaning |
|---|---|
| `--json` | Machine-readable output. |
| `--pretty` | Force human-readable output even when piped. |
| `--raw` | Return the underlying API response for data commands. |

When stdout is piped, commands automatically emit JSON unless `--pretty` is supplied.

```sh
dyngja transactions --count 10 --json
dyngja whoami --json | jq '.email'
dyngja schema transactions --json
```

Exit codes are stable for automation: `0` success, `1` runtime/API error, `2` authentication required or rejected, and `64` invalid usage.

## Development

```sh
bun run check
bun test
bun run build
```

Dyngja accounts and balances in this project are virtual. This CLI does not connect to a brokerage or place real-money trades.
