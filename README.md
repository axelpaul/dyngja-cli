# dyngja-cli

Command-line client and MCP server for [Dyngja](https://dyngja.app/), the virtual (play-money) Icelandic stock-market investing app: market data, portfolio, trades, contests, education and social features.

> Unofficial — not affiliated with Dyngja. The API is undocumented and reverse-engineered from the app; it can change without notice. All balances and trades are virtual and use the app's simulated market.

## Install

Requires [Bun](https://bun.sh) ≥ 1.1.

```sh
bun add -g github:axelpaul/dyngja-cli     # install
bun add -g github:axelpaul/dyngja-cli     # update (re-run; pulls the latest default branch)
bun remove -g dyngja-cli                  # uninstall
```

This installs the `dyngja` command into `~/.bun/bin`.

Prefer a single binary? Download `dyngja-<os>-<arch>` for Linux, macOS or Windows from the [Releases page](https://github.com/axelpaul/dyngja-cli/releases), check it against `SHA256SUMS`, make it executable and put it on your `PATH`.

## Authentication

You need a Dyngja account (create one in the app or with `dyngja register`).

```sh
dyngja login          # prompts for email and password
dyngja whoami
dyngja doctor         # checks API reachability and the saved session
dyngja logout
```

Non-interactive (CI, agents):

```sh
DYNGJA_USER=you@example.com DYNGJA_PW='your-password' dyngja login
```

The password is only sent to Dyngja's login endpoint; only the returned session token is stored, in `~/.config/dyngja-cli/auth.json` (mode `0600`). The MCP server reuses that session, so sign in once in a terminal before using it.

New accounts:

```sh
dyngja register --email you@example.com --name "Jón Jónsson"
dyngja confirm --email you@example.com --code 123456
dyngja resend --email you@example.com
```

## CLI usage

### Market, portfolio and trades

```sh
dyngja market info            # delayed data? sale commission (no login needed)
dyngja market stocks --json
dyngja portfolio --json       # --account-id, --user-id, --contest-id, --count, --sort
dyngja transactions --count 20

dyngja buy  --ticker MAREL --units 10 --yes
dyngja sell --ticker MAREL --units 3  --yes
dyngja buy  --ticker MAREL --units 10 --rate 120 --dry-run   # local estimate, nothing sent
```

`buy` and `sell` send market orders from the signed-in user's main business account. Add `--business-account-id <id>` to trade from a different virtual account. Orders require `--yes`; `--dry-run` shows the request without sending it. `--rate` is only used for the dry-run estimate.

### App features

```text
dyngja profile    show | update | notifications | feedback | message | picture
dyngja account    show | business-account | patch-business-account | device-token | reset
dyngja history    recent | recent-account | buy | sell | sales | purchases
                  | sales-by-id | purchases-by-id | historic | total | yesterday
dyngja contests   list | random | search | get | participants | invites | team-statistics
                  | join | join-pin | leave | team-join | accept-invite | delete-invite
dyngja users      search | most-followed | most-profited | news-feed | team-statistics
                  | follow | unfollow
dyngja education  chapters | progress | achievements | videos | update
dyngja analytics  contest-ownerships | position
dyngja ads
```

Examples:

```sh
dyngja history recent --count 10
dyngja contests search --query skóli
dyngja users search --query jon
dyngja users follow --user-id 12345 --yes
dyngja profile notifications --daily-notifications false --yes
dyngja education update --chapter-id 3 --yes
```

Every state-changing command requires `--yes` and accepts `--dry-run`. Use `--data '{"field":"value"}'` when an action needs a payload that no convenience flag covers.

### Raw API access

For a route without a convenience command:

```sh
dyngja api /api/v3/ownerships/ --json
dyngja api /api/v1/transactions/ --method POST \
  --data '{"units":10,"symbol":"MAREL","type":"buy","business_account_id":"<account-id>"}' --yes
```

### Output and exit codes

| Flag | Meaning |
|---|---|
| `--json` | Machine-readable output (default when stdout is piped). |
| `--pretty` | Force human-readable output when piped. |
| `--raw` | Return the underlying API response. |
| `--yes` | Confirm a state-changing request. |
| `--dry-run` | Show a state-changing request without sending it. |

Exit codes: `0` success, `1` runtime/API error, `2` authentication required or rejected, `64` invalid usage.

`dyngja schema <command>` prints the JSON shape a command returns, for agents.

## MCP server

`dyngja serve` starts a [Model Context Protocol](https://modelcontextprotocol.io) server over stdio. Its tools call the same client code as the CLI. Read tools are always available. Write tools are only listed when `DYNGJA_MCP_ENABLE_WRITES=1` is set, and each one also requires `"confirm": true` in its input.

| Tool | Access | Description |
|---|---|---|
| `market_info` | read | App settings: delayed market data, sale commission. No login needed. |
| `ads` | read | Current in-app advertisements. No login needed. |
| `whoami` | read | Signed-in user and main business account (balance, transaction count). |
| `business_account` | read | Raw details of the signed-in user's business account. |
| `stocks` | read | Tradable stocks with ticker, name and price. |
| `portfolio` | read | Holdings; optional `business_account_id`, `user_id`, `contest_id`, `count`, `sort`. |
| `transactions` | read | Recent buy/sell transactions; optional `count`. |
| `history` | read | Activity and performance feeds (`kind` = the `dyngja history` actions). |
| `contests` | read | List, search and inspect contests and invites. |
| `users` | read | Search users, most followed/profited, news feed, team statistics. |
| `education` | read | Chapters, your progress, achievements, videos. |
| `contest_ownership_totals` | read | Aggregated holdings across business accounts in a contest. |
| `contest_position` | read | A user's position in a contest (raw request body). |
| `trade` | write | Buy or sell at market on the simulated market. |
| `follow_user` | write | Follow or unfollow a user. |
| `join_contest` | write | Join a contest by PIN, or join a contest team. |
| `update_education_progress` | write | Record education progress for a chapter. |
| `update_profile` | write | Change display name, notification and search visibility settings. |
| `send_feedback` | write | Send feedback or a message to the Dyngja team. |
| `patch_business_account` | write | Change fields on your business account (raw body). |
| `reset_account` | write | Reset your virtual account. Cannot be undone. |

Not exposed over MCP, on purpose:

- `login`, `logout`, `register`, `confirm`, `resend`: credential and account-lifecycle flows belong in a terminal. Sign in with `dyngja login` first.
- `api`: the raw escape hatch can call any route with any method, which would bypass the read/write split.
- `contests join | leave | accept-invite | delete-invite`: the app's exact routes for these are not confirmed, and the CLI sends all four to the same endpoint, so an agent cannot rely on them. Use the CLI with `--dry-run` first if you need them.
- `profile picture` (needs an image upload) and `account device-token` (push-notification token for the phone app).
- `doctor`, `schema`, `market root`: local diagnostics.

### Claude Code

```sh
claude mcp add dyngja -- dyngja serve
# with write tools:
claude mcp add dyngja -e DYNGJA_MCP_ENABLE_WRITES=1 -- dyngja serve
```

### Claude Desktop, Cursor and other JSON-configured clients

```json
{
  "mcpServers": {
    "dyngja": {
      "command": "dyngja",
      "args": ["serve"]
    }
  }
}
```

GUI apps often don't have `~/.bun/bin` on their `PATH`. If the server fails to start, use the absolute path from `which dyngja` as `command`. Pass environment variables with an `env` block, for example to enable writes:

```json
{
  "mcpServers": {
    "dyngja": {
      "command": "/Users/you/.bun/bin/dyngja",
      "args": ["serve"],
      "env": { "DYNGJA_MCP_ENABLE_WRITES": "1" }
    }
  }
}
```

## Configuration

| Variable | Description |
|---|---|
| `DYNGJA_USER` / `DYNGJA_EMAIL` | Email used by `dyngja login` instead of prompting. |
| `DYNGJA_PW` / `DYNGJA_PASSWORD` | Password used by `dyngja login` instead of prompting. |
| `DYNGJA_MCP_ENABLE_WRITES` | Set to `1` to expose write tools in `dyngja serve`. |
| `DYNGJA_CONFIG_DIR` | Override the config directory. |
| `DYNGJA_API_URL` | Override the API base URL (default `https://dyngja.reynirf.com`). |
| `XDG_CONFIG_HOME` | Base for the config directory (default `~/.config`). |
| `NO_COLOR` | Disable colored output. |

Files, in `$XDG_CONFIG_HOME/dyngja-cli/` (default `~/.config/dyngja-cli/`):

- `auth.json`: session token and cached user summary (mode `0600`).
- `config.json`: optional, e.g. `{"baseUrl": "https://..."}`.

Sessions saved by older versions in `~/.config/dyngja/` are still read.

## Development

```sh
git clone https://github.com/axelpaul/dyngja-cli.git
cd dyngja-cli
bun install
bun run check        # biome lint, tsc, bun test
bun src/index.ts --help
bun run build        # single binary in dist/dyngja
```

Releases: pushing a `v*` tag runs the checks, builds binaries for Linux, macOS and Windows (x64 and arm64, Windows x64 only) and attaches them with `SHA256SUMS` to a GitHub release.
