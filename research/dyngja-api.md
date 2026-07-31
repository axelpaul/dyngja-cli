# Dyngja API investigation

Status: initial contract discovery, 2026-07-31.

This is a research snapshot, not an official API specification. It combines the public app listings, a locally downloaded APK, static analysis of its Flutter AOT client, and read-only checks against the live service.

## What the app is

Dyngja is a virtual-money investing app for learning about the Icelandic stock market. The app describes simulated investing, contests, following other investors, and investing education. The official site calls the virtual currency vISK.

- [Official site](https://dyngja.app/)
- [Google Play listing](https://play.google.com/store/apps/details?id=is.dyngja.dyngja)
- [Apple App Store listing](https://apps.apple.com/us/app/dyngja/id1551847587)
- [APKPure listing](https://apkpure.net/dyngja/is.dyngja.dyngja)
- [Live API documentation](https://dyngja.reynirf.com/docs/)

## APK artifact

The public APK source used for static analysis was APKPure’s XAPK download:

| Property | Value |
|---|---|
| Package | `is.dyngja.dyngja` |
| Downloaded app build | 3.9.0, version code 80 |
| Container | XAPK, with base APK and Android ABI/config splits |
| Base APK | `is.dyngja.dyngja.apk` |
| ABI analyzed | `arm64-v8a` |
| SHA-256 | `628c4e96fbd5cde3d34a570587c84949177bea803d82de9f32bf6f5f8555ea53` |
| Flutter/Dart snapshot | Dart 3.5.0, compressed pointers |
| App implementation | Flutter AOT in `libapp.so` |

The public store data currently reports Android 4.0.2/version code 85, so the APK above is useful for discovery but cannot be treated as the latest client contract. The XAPK is kept as a local ignored artifact rather than committed to this repository.

## Live service and authentication

The client embeds `https://dyngja.reynirf.com/`. The API is a Django REST-style service with an `/api/v3/` surface and separate `/auth/` routes.

Verified read-only observations:

- `GET https://dyngja.reynirf.com/api/v3/app-info/` returns HTTP 200 and currently reports `{"delayed_data":true,"sale_commission":0.0}`.
- `GET https://dyngja.reynirf.com/api/v3/transactions/` returns HTTP 401 and advertises `GET, POST`.
- `GET https://dyngja.reynirf.com/api/v3/users/` returns HTTP 401 and advertises `GET, POST`.
- `GET https://dyngja.reynirf.com/api/v3/users/myself/` returns HTTP 401 and advertises `GET, PATCH`.
- `GET https://dyngja.reynirf.com/api/v3/ownerships/all/from_contest_total/` returns HTTP 401 and advertises `POST`.
- `GET https://dyngja.reynirf.com/api/v3/ownerships/all/user_position_in_contest/` returns HTTP 401.
- `GET https://dyngja.reynirf.com/api/v3/ads/` returns HTTP 401.
- The Swagger UI is public at `/docs/`, but its advertised `?format=openapi` schema currently returns HTTP 500. That is why the inventory below also records static-analysis confidence.

The APK contains the literal `Token ` and its authenticated helpers build the standard header:

```http
Authorization: Token <token returned by login>
```

The public `OPTIONS` metadata confirms the login contract:

```http
POST /auth/login/
Content-Type: application/json

{"username":"...","password":"..."}
```

The response includes a read-only `token` field. Other public auth routes are:

```text
POST /auth/register/
POST /auth/google/
POST /auth/facebook/
POST /auth/confirm-account/
POST /auth/re-send/
POST /auth/reset-password-code/
POST /auth/reset-password/
POST /auth/confirm-reset-password-code/
```

Registration and reset payload names are not fully exposed by the public `OPTIONS` response. The APK has separate `register`, `loginWithGoogle`, and `loginWithFacebook` wrappers, but some of those wrappers contain only route fragments; validate them against the current build before coding them as stable paths.

## Recovered client API inventory

The APK’s `package:dyngja/api.dart` is not obfuscated. Static analysis recovered named wrappers and showed whether each calls the client’s authenticated GET or authenticated POST helper. The app builds many paths by interpolation, so entries marked “dynamic” need a real authenticated response or a current APK trace to pin down the final URL.

### High-confidence routes and operations

| Operation | HTTP | Route or route family | Confidence |
|---|---:|---|---|
| App info | GET | `/api/v3/app-info/` | live + APK |
| Login | POST | `/auth/login/` | live `OPTIONS` + APK |
| Register | POST | `/auth/register/` | live `OPTIONS`; APK wrapper also has `/users/` fragment |
| Google login | POST | `/auth/google/` | live `OPTIONS` |
| Facebook login | POST | `/auth/facebook/` | live `OPTIONS` + APK |
| Confirm account | POST | `/auth/confirm-account/` | live `OPTIONS` + APK |
| Re-send confirmation | POST | `/auth/re-send/` | live `OPTIONS` + APK |
| Send reset code | POST | `/auth/reset-password-code/` | live `OPTIONS` + APK |
| Reset password | POST | `/auth/reset-password/` | live `OPTIONS` + APK |
| Confirm reset code | POST | `/auth/confirm-reset-password-code/` | live `OPTIONS` + APK |
| Users | GET, POST | `/api/v3/users/` | live `Allow` + APK |
| Current user | GET, PATCH | `/api/v3/users/myself/` | live `Allow` + APK |
| Transactions | GET, POST | `/api/v3/transactions/` | live `Allow` + APK route literal |
| Contest ownership totals | POST | `/api/v3/ownerships/all/from_contest_total/?count=...` | live + APK |
| Contest user position | POST | `/api/v3/ownerships/all/user_position_in_contest/` | live + APK |
| Ads | GET | `/api/v3/ads/` | live + APK |

### Named wrappers recovered from `api.dart`

These names are the useful starting point for the CLI adapter. “Auth GET/POST” means the wrapper adds the `Token` header before dispatching.

| Wrapper | Method | Recovered route clues |
|---|---:|---|
| `getUserContests` | GET | `/contests/` plus an interpolated value; uses a limited-retry path |
| `createTransaction` | POST | trade path assembled from `/users/` and runtime values; transaction route literal is also present in the snapshot |
| `getAchievements` | GET | `/users/` family |
| `getSalesLazyFromId`, `getSalesLazy` | GET | `/sales_lazy/?count=...` and `/users/` family |
| `getPurchasesLazyFromId`, `getPurchasesLazy` | GET | `/purchases_lazy/?count=...` and `/users/` family |
| `getMostFollowedUsers` | GET | `/users/self/business_account/` |
| `getYesterdaysTotalByBID` | GET | `/users/myself/` family |
| `getOwnershipsByBID` | GET | `/users/myself/` family, business-account value interpolated |
| `getUserById` | GET | `/users/myself/` family |
| `getContestById` | GET | `/contests/` plus contest ID |
| `getLeaderboardPosition` | POST | `/users/myself/` family |
| `getOwnershipsFromBusinessAccounts` | POST | contest ownership aggregation |
| `getContestSalesLazy` | POST | `/users/` family |
| `getContestPurchasesLazy` | POST | `/users/` family |
| `getRecentTransactionsByBid` | GET | `/users/` family |
| `getRecentTransactions` | GET | `/users/` family; an `always` option is present |
| `getTotalHistoryDataByBID` | GET | `/users/myself/` family |
| `getTeamStatistics` | POST | `/users/myself/` family |
| `getHistoricData` | GET | `/users/myself/` plus `/historic-data/?type=...` and `&stockType=...` |
| `getUserInformationByBusinessAccountId` | GET | `/users/myself/` family |
| `getAdsV3` | GET | `/api/v3/ads/` |
| `getUserInformation` | GET | `/users/myself/` family |
| `getRandomContests` | GET | `/contests/` family |
| `getUserInvites` | GET | `/contests/` family |
| `getChapters` | GET | `/users/myself/` plus `api/v3/users/` and `/chapters/` fragments |
| `getVideos` | GET | `/users/myself/most_followed/` family |
| `getBusinessAccount` | GET | `/users/myself/` family |
| `getEducationalProgress` | GET | `/users/myself/` family |
| `getStocks` | GET | `/users/myself/` family; stock response parser |
| `getOwnerships` | GET | `/users/myself/` family with `sortType` query key |
| `getUser` | GET | current-user path; embeds the production host |
| `updateDeviceToken` | POST | `/users/myself/` family |
| `getTotalHistoryData` | GET | `/users/myself/` family |
| `getMessage` | GET | `/users/myself/` family |
| `getNewsFeed` | GET | `/users/myself/` family; `/news_feed/` model route clue |
| `getYesterdaysTotal` | GET | `/users/myself/yesterdays_total/` |
| `updateMessage` | POST | `/users/myself/` family |
| `getMostProfitedUsers` | GET | `/users/self/business_account/` |
| `editProfilePicture` | POST | `/users/myself/` family |
| `getUsersByQuery` | GET | `/users/myself/` family |
| `unfollowUser` | POST | `/users/myself/` family |
| `resetAccount` | POST | `/users/myself/` family |
| `patchBusinessAccount` | POST | `/users/myself/` family |
| `joinTeamById` | POST | `/contests/` and `/users/self/business_account_patch/` |
| `joinContest` | POST | `/contests/` |
| `leaveContest` | POST | `/contests/` |
| `followUser` | POST | `/users/myself/` family |
| `acceptInvite` | POST | `/contests/` |
| `deleteInvite` | POST | `/contests/` |
| `joinContestByPin` | POST | `/contests/` |
| `sendFeedback` | POST | `/users/myself/` plus `/feedback/` clue |
| `updateName` | POST | `/users/myself/` family |
| `updateOtherNotification` | POST | `/users/myself/` family |
| `updateDailyNotification` | POST | `/users/self/daily_notifications/` |
| `updateShowInSearch` | POST | `/users/self/show_in_search/` |
| `updateEducationalProgress` | POST | `/users/self/update_educational_progress/` |

The app also opens a market WebSocket at `/ws/market/`. The handshake/authentication and message schema still need runtime capture; it should not be the first dependency of the CLI.

## Data model clues

The recovered JSON parsers and string pool expose enough vocabulary to design typed output, but not enough to safely construct a trade request without a test response:

- `Ownership`: `units_owned`, stock/company references.
- `StockMini`: `current_rate`, company reference.
- `BusinessAccount`: `balance`, `contest_id`.
- `Transaction`: `commission`, `connection`, plus fields represented by `stock_type`, `units`, `rate`, `price`, `amount`, `quantity`, `type`, and `date` literals.
- `Stock`: `hidden`, `see_more_url`, `intraday_change`, `daily_data`; related model literals include `ticker`, `symbol`, `rate`, `last_price`, and `company`.
- `User`/`Profile`: `username`, `last_name`, `profile`, `other_business_accounts`, `main_business_account`, `login_method`, `show_in_search`, `daily_notifications`, `other_notifications`, `last_reset_date`.
- Contest objects: `start_date`, `end_date`, `initial_money`, `business_account_id`, participant/team fields.
- App info: `delayed_data`, `sale_commission`.

The app’s education/contest UI contains a default virtual balance of 1,000,000 vISK. That is simulated account state, not real brokerage access.

## Proposed CLI surface

The public interface should be stable even if Dyngja’s internal route fragments move:

```text
dyngja auth login
dyngja profile
dyngja market stocks
dyngja market stock <stock-id>
dyngja portfolio [--contest <id>]
dyngja transactions list [--all]
dyngja history <stock-id>
dyngja contests list
dyngja contests join --id <id>
dyngja trade buy <stock-id> --units <n> [--account <id>]
dyngja trade sell <stock-id> --units <n> [--account <id>]
dyngja agent run --dry-run
dyngja agent run --execute-virtual-trades
```

Implementation should put all unstable details in one adapter layer:

1. `AuthClient`: login, token storage, refresh/re-login handling.
2. `DyngjaApi`: typed HTTP methods and route templates.
3. `PortfolioSnapshot`: normalized balance, positions, prices, commissions, and timestamps.
4. `TradeExecutor`: validation, explicit buy/sell confirmation, and no automatic retry of a trade POST.
5. `AgentRunner`: strategy decisions against snapshots, dry-run ledger, and P&L evaluation.

## Remaining validation work

Before implementing `trade buy`/`sell`, use a dedicated Dyngja test account and the current APK/server combination to capture one successful virtual buy and sell. Record only sanitized request/response shapes:

- exact full URL and HTTP verb;
- request JSON keys and numeric types;
- stock identifier versus ticker semantics;
- account/contest identifier semantics;
- whether `action` is buy/sell or whether the route differs;
- commission calculation and rounding;
- response status and resulting balance/ownership changes;
- whether the market WebSocket is required for current prices.

Do not retry a trade POST automatically until idempotency behavior is known. Do not use scraping or auth bypasses. The agent should never be given a route capable of real-money brokerage activity; this project is scoped to Dyngja’s virtual-money simulation.

