# Architecture

## Request path

Every write follows the same path. No layer is skipped.

```
React component
  └── feature hook (TanStack Query)
        └── feature api module
              └── api client  (auth header, refresh-on-401, error envelope)
                    │  HTTPS
                    ▼
              Express route      — path, middleware, RBAC
                    ▼
              Controller         — parse validated input, shape the response
                    ▼
              Service            — business rules, transactions
                    ▼
              Repository         — data access only
                    ▼
              Prisma  ──▶ SQLite (edurewards.db)
```

Business logic never lives in a route, a controller or a React component.
Repositories never contain business rules. Services never issue raw Prisma
queries outside their own domain.

## The points engine

`PointsLedger` is the single source of truth for every point that exists.

- **Append-only.** No code path updates or deletes a historical ledger row.
  Corrections are new `REVERSAL` or `ADJUSTMENT` rows.
- **Idempotent.** A unique index on `(userId, transactionType, sourceType, sourceId)`
  makes double-crediting physically impossible at the database level. A repeat
  attempt returns `duplicate: true` rather than creating a second row.
- **Derived wallet.** `Wallet` holds materialised balances purely for read
  performance. It is only ever written inside the same transaction that appends
  a ledger row, by `PointsService.award()`.
- **No negative buckets.** `applyDelta` refuses any movement that would leave a
  negative available, locked, pending, redeemed or expired balance.

Because of these four properties, `sum(ledger.points) === wallet.availablePoints`
is an invariant the platform can be audited against, and the Super Admin
liability figure reconciles exactly with the ledger.

## Approval as a single transaction

Approving a submission is one Prisma transaction covering:

```
submission status
  + POST_REWARD ledger row + wallet movement
  + referral distribution (one LEVEL_BONUS row per eligible ancestor)
  + campaign budget increment
  + notifications
  + review trail
  + audit record
```

If any step fails, none of it happened. There is no state in which an
ambassador is credited but their upline is not, or a budget is consumed without
a corresponding award.

## Referral engine

A **closure table** (`ReferralClosure`) stores one row per ancestor/descendant
pair, including a depth-0 self row. This turns "find everyone above this user,
in order, up to N levels" into a single indexed query rather than a recursive walk.

Guarantees enforced in `ReferralService`:

| Rule | Mechanism |
|---|---|
| Unique codes | Unique index plus retry-on-collision |
| No self-referral | Explicit check before insert |
| No circular referral | `isDescendant` check before linking |
| Parent immutability | `ReferralRelation.childId` is unique; re-attach is refused |
| Suspension preserves structure | `earningsPaused` flag; the tree is never rewritten |
| Deletion re-parents | `reparentChildren` rebuilds only the affected subtree |

Depth and per-level percentages are configuration, read from `AppSetting` on
every distribution. Nothing in the codebase hardcodes "four levels".

## Economics as configuration

All economics live in `AppSetting` behind `SettingsService`, cached for 15
seconds. Changing them affects future transactions only — historical ledger
entries are never recomputed, which keeps past balances and liability reporting
stable and defensible.

## Authentication

- Short-lived JWT access token, held **in memory only** on the client.
- Long-lived opaque refresh token in an httpOnly cookie, stored server-side as a
  SHA-256 hash.
- **Rotation with reuse detection**: presenting an already-rotated refresh token
  revokes the entire token family and writes an audit record.
- Role and account status are re-read from the database on every request, so a
  token minted before a demotion or suspension stops working immediately.

## Fraud and risk

`RiskService` records events and raises flags for self-referral, circular
referral, duplicate phone/PAN/UPI, duplicate post URLs, shared IPs, shared
device fingerprints, high rejection rates and abnormal referral velocity. Flags
are idempotent per `(user, type)` — repeat detections increment the score rather
than spawning duplicates.

Reviewers see a computed signal list on every submission before deciding.

## Post liveness

A scheduled job re-checks approved post URLs through a pluggable
`SocialAdapter`. The adapter contract requires `UNKNOWN` (never `REMOVED`) for
timeouts, rate limits and 5xx responses, and reversal only happens after a
configurable number of *consecutive definitive* failures. One bad network day
can never cost an ambassador their points.

## Background jobs

An in-process scheduler runs liveness checks, points expiry, leaderboard
rebuilds, low-stock voucher alerts and campaign lifecycle transitions. Handlers
are plain async functions with no scheduler coupling, so moving to BullMQ or a
managed queue is a producer change only.
