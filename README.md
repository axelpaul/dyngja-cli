# dyngja-cli

Use [Dyngja](https://dyngja.app/) from your terminal. The CLI exposes the virtual Icelandic market, portfolio, trades, account activity, contests, education, social features, and a direct API escape hatch for automation and AI agents.

Built with [Bun](https://bun.sh/). JSON output is the default for piped commands, and sessions are stored locally with restrictive permissions.

## Install

Requires Bun ≥ 1.3.

```sh
git clone https://github.com/axelpaul/dyngja-cli.git
cd dyngja-cli
bun install
bun link
dyngja login
```

Run without linking with `bun src/index.ts <command>`.

## Sign in

```sh
dyngja login
dyngja whoami
dyngja logout
```

For CI and agents:

```sh
DYNGJA_USER=you@example.com DYNGJA_PW='your-password' dyngja login
```

The session is cached at `~/.config/dyngja/auth.json` with mode `0600`. Use `dyngja doctor` to check connectivity and authentication.

## Trade and portfolio

```sh
dyngja market info --json
dyngja market stocks --json
dyngja portfolio --json
dyngja transactions --count 20 --json

dyngja buy  --stock-type MAREL --units 10 --rate 92.50 --yes
dyngja sell --stock-type MAREL --units 3  --rate 101.00 --yes
```

`buy` and `sell` require `--yes`. Preview an order without sending it with `--dry-run`.

## App features

```text
dyngja profile show|update|notifications|feedback|message|picture
dyngja account show|business-account|patch-business-account|device-token|reset
dyngja history recent|sales|purchases|buy|sell|historic|total|yesterday
dyngja contests list|random|search|get|join|join-pin|leave|team-join|invites
dyngja users search|most-followed|most-profited|news-feed|follow|unfollow
dyngja education chapters|progress|update|achievements|videos
dyngja analytics contest-ownerships|position
dyngja ads
```

Every state-changing command requires `--yes` and accepts `--dry-run`. Use `--data '{"field":"value"}'` when an app action needs a payload that is not covered by a convenience flag.

For an endpoint that does not yet have a convenience command:

```sh
dyngja api /api/v3/ownerships/ --json
dyngja api /api/v3/transactions/ --method POST --data '{"rate":92.5,"stock_type":"MAREL","units":10}' --yes
```

## Output

| Flag | Meaning |
|---|---|
| `--json` | Machine-readable output. |
| `--pretty` | Force human-readable output when piped. |
| `--raw` | Return the underlying API response. |
| `--yes` | Confirm a state-changing request. |
| `--dry-run` | Show a state-changing request without sending it. |

Exit codes: `0` success, `1` runtime/API error, `2` authentication required or rejected, and `64` invalid usage.

## Development

```sh
bun run check
bun test
bun run build
```

Dyngja balances and trades are virtual and use the app's simulated market.
