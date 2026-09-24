# EduRewards — Complete Documentation

**Ambassador Rewards & Referral Platform**
React + Vite · Node.js + Express · Prisma · SQLite

> This document is written for someone who has never seen the codebase before and
> needs to understand it, run it, and change it. Every section tells you not just
> *what* something does, but *which file to open* when you want to change it.

---

## Table of contents

1. [What this application does](#1-what-this-application-does)
2. [Quick start](#2-quick-start)
3. [Repository map](#3-repository-map)
4. [Architecture and request lifecycle](#4-architecture-and-request-lifecycle)
5. [The data model](#5-the-data-model)
6. [Business rules that matter](#6-business-rules-that-matter)
7. [Backend, layer by layer](#7-backend-layer-by-layer)
8. [Frontend, layer by layer](#8-frontend-layer-by-layer)
9. [API reference](#9-api-reference)
10. [How do I — the cookbook](#10-how-do-i--the-cookbook)
11. [Security model](#11-security-model)
12. [Testing](#12-testing)
13. [Deployment](#13-deployment)
14. [Troubleshooting](#14-troubleshooting)
15. [Glossary](#15-glossary)

---

# 1. What this application does

## The core loop

```
A student signs up  ──▶  gets a referral code  ──▶  shares it
                                                      │
                                                      ▼
                                  A friend joins using that code
                                                      │
                                                      ▼
                    Both promote campaigns on Instagram / LinkedIn / X …
                                                      │
                                                      ▼
                           They submit the live post link for review
                                                      │
                                                      ▼
                    An admin approves it  ──▶  points are credited
                                                      │
                                    ┌─────────────────┴─────────────────┐
                                    ▼                                   ▼
                      The poster gets full credit          Everyone above them in the
                                                            referral tree gets a % share
                                                      │
                                                      ▼
                        Points are redeemed for vouchers or cash
```

## The three roles

| Role | Can do |
|---|---|
| **`USER`** (Ambassador) | Register, refer others, browse and join campaigns, submit posts, view wallet and ledger, redeem rewards, request cash payouts, view analytics and leaderboard, raise support tickets |
| **`ADMIN`** | Everything a user can, plus: verify submissions, approve/reject redemptions, manage users (suspend, adjust points), create and manage campaigns, work the risk queue, answer support tickets, run reports, publish announcements |
| **`SUPER_ADMIN`** | Everything an admin can, plus: create/remove administrators, change points economics, manage voucher inventory, view liability, read the audit log, reverse approved submissions, manage institutions |

Roles are **hierarchical**. A Super Admin can do anything an Admin can. This is
enforced by `requireMinRole()` in `backend/src/middleware/auth.ts` using the
`ROLE_RANK` map in `shared/constants/index.ts`.

## The vocabulary

| Term | Means |
|---|---|
| **Ambassador** | A `USER`-role account that promotes campaigns |
| **Campaign** | A promotional brief with a points value, date window, platform list and budget |
| **Submission** | An ambassador's claim that they posted for a campaign, pending review |
| **Points** | The platform currency. Earned by approved posts and referrals, spent on rewards |
| **Ledger** | The append-only record of every point movement. The source of truth |
| **Wallet** | Materialised balances (available / locked / redeemed …) derived from the ledger |
| **Referral ladder** | The percentages paid to each level above an ambassador when they earn |
| **Closure table** | The database structure that makes "who is above this user" a fast query |
| **Redemption** | A request to exchange points for a reward |
| **Voucher code** | A single-use code from a pool, assigned on redemption approval |
| **Risk flag** | An automated fraud signal awaiting human review |

---

# 2. Quick start

## Prerequisites

- **Node.js 20+** — check with `node -v`
- **npm 10+** — check with `npm -v`

No database server needed. SQLite is just a file on disk.

## Five commands

```bash
# 1. Install both workspaces (backend + frontend)
npm install

# 2. Create your environment file
cp .env.example backend/.env

# 3. Generate real secrets and paste them into backend/.env
node scripts/generate-secrets.js

# 4. Create the database and fill it with realistic demo data
npm run db:migrate
npm run db:seed

# 5. Start both servers
npm run dev
```

| What | Where |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:4000 |
| Interactive API docs | http://localhost:4000/api/docs |
| Health check | http://localhost:4000/health/ready |
| Database browser | `npm run db:studio` |

## Sign in

All demo accounts use whatever you set as `SEED_PASSWORD` in `backend/.env`
(default: `EduRewards#2026`).

| Role | Email |
|---|---|
| Super Admin | `admin@edurewards.local` |
| Admin | `ops@edurewards.local` |
| Ambassador | `ambassador@edurewards.local` |

> These accounts exist **only** in `backend/prisma/seed.ts` and take their password
> from an environment variable. No credential is committed to the repository.

## A five-minute tour

This is the fastest way to understand the whole system:

1. **Sign in as the ambassador.** Look at the dashboard — stats, referral link,
   charts, recent activity. All of it comes from one API call.
2. **Open Network.** Expand the tree. Notice each member shows how many points
   *they* generated *for you*. That number comes from the ledger, not a counter.
3. **Open Wallet.** Every row is a ledger entry. Note the "Level 2 bonus" entries —
   those came from someone two levels below you getting a post approved.
4. **Go to Campaigns → pick one → Submit a post.** Paste any `https://instagram.com/p/...`
   URL and complete the five steps.
5. **Sign out. Sign in as `ops@edurewards.local`.** Go to Verifications.
   Your submission is at the top. Click it, read the risk signals, click **Approve**.
6. **Watch the toast.** It tells you exactly how many points went to the poster
   *and* how many were distributed across the network.
7. **Sign back in as the ambassador.** The wallet balance moved. The ledger has
   new rows. The dashboard chart updated.
8. **Sign in as `admin@edurewards.local`** (Super Admin). Open **Liability** —
   your approval is now part of the platform's financial exposure. Open
   **Audit Log** — the approval is recorded, immutably, with before/after state.

That loop is the entire product.

---

# 3. Repository map

```
edurewards/
│
├── backend/                    ← The REST API
│   ├── prisma/
│   │   ├── schema.prisma       ← THE DATA MODEL. Start here.
│   │   ├── migrations/         ← Generated by `npm run db:migrate`
│   │   └── seed.ts             ← Demo data generator
│   ├── data/
│   │   └── edurewards.db       ← The SQLite database (generated, gitignored)
│   ├── uploads/                ← Screenshots, creatives, KYC docs (gitignored)
│   ├── tests/                  ← Vitest + supertest integration tests
│   └── src/
│       ├── config/             ← env validation, Prisma client, logger
│       ├── middleware/         ← auth, validation, uploads, errors, security
│       ├── routes/             ← URL paths + which middleware guards them
│       ├── controllers/        ← Unwrap request → call service → shape response
│       ├── services/           ← ALL BUSINESS LOGIC LIVES HERE
│       ├── repositories/       ← Database queries only, no rules
│       ├── validators/         ← Zod schemas for request validation
│       ├── jobs/               ← Scheduled background work
│       ├── integrations/       ← External service adapters (social liveness)
│       ├── errors/             ← Custom error classes
│       ├── utils/              ← Pure helpers (crypto, dates, URLs, CSV…)
│       ├── docs/openapi.ts     ← The Swagger specification
│       ├── app.ts              ← Express app assembly
│       └── server.ts           ← Boot, listen, graceful shutdown
│
├── frontend/                   ← The React application
│   ├── index.html
│   ├── vite.config.ts          ← Build config, dev proxy, PWA setup
│   └── src/
│       ├── main.tsx            ← Entry point
│       ├── api/
│       │   ├── client.ts       ← fetch wrapper: auth, refresh-on-401, errors
│       │   └── queryClient.ts  ← TanStack Query config + ALL query keys
│       ├── components/ui/      ← The design system (~40 components)
│       ├── features/           ← One folder per product area
│       ├── layouts/            ← App shell, sidebar, topbar, mobile nav
│       ├── routes/             ← Route table + auth guards
│       ├── hooks/              ← Shared hooks (filters, media queries, badges)
│       ├── store/              ← Zustand stores (auth, UI)
│       ├── utils/              ← Formatting, sharing, downloads
│       └── styles/
│           ├── tokens.css      ← EVERY COLOUR AND SIZE. Start here for theming.
│           └── global.css      ← Resets, utilities, animations
│
├── shared/                     ← Used by BOTH backend and frontend
│   ├── constants/index.ts      ← Enums, setting keys, role ranks
│   ├── types/index.ts          ← API response shapes
│   └── schemas/index.ts        ← Zod schemas (validation shared client + server)
│
├── docs/ARCHITECTURE.md        ← Deep dive on the engine internals
├── docker/                     ← Dockerfiles + nginx config
├── scripts/generate-secrets.js ← Produces strong secret values
├── .env.example                ← Template for backend/.env
└── package.json                ← Workspace root, all the npm scripts
```

## The `shared/` folder is important

Anything in `shared/` is imported by **both** sides:

- The backend imports `shared/schemas` to validate an incoming request body.
- The frontend imports the **same schema** to validate the form before sending it.

This means a validation rule is written once. If you change the minimum password
length in `shared/schemas/index.ts`, both the form hint and the server rejection
update together. There is no way for them to drift apart.

```
shared/schemas/index.ts
        │
        ├──────────────▶ backend/src/validators/index.ts  →  validate() middleware
        │
        └──────────────▶ frontend/…/SignupPage.tsx        →  zodResolver(registerSchema)
```

---

# 4. Architecture and request lifecycle

## The layered path

Every single write in this application follows the same route. Nothing skips a layer.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. React component                                          │
│    User clicks "Approve"                                    │
│    frontend/src/features/verification/components/ReviewDrawer.tsx │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Mutation hook (TanStack Query)                           │
│    useMutation({ mutationFn: () => submissionApi.approve() })│
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Feature API module                                       │
│    frontend/src/features/submissions/api.ts                 │
│    api.post(`/verifications/${id}/approve`)                 │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. API client                                               │
│    frontend/src/api/client.ts                               │
│    Adds Bearer token · retries once on 401 · unwraps envelope│
└──────────────────────────┬──────────────────────────────────┘
                           │   HTTP POST /api/v1/verifications/:id/approve
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Express middleware chain                                 │
│    requestContext → helmet → cors → rateLimit →             │
│    authenticate → requireMinRole('ADMIN') → validate(schema) │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Route                                                    │
│    backend/src/routes/verification.routes.ts                │
│    Declares the path and its guards. No logic.              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Controller                                               │
│    backend/src/controllers/submission.controller.ts         │
│    Reads validated input, calls the service, shapes output. │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Service  ← ALL BUSINESS RULES                            │
│    backend/src/services/verification.service.ts             │
│    Opens a transaction. Calls PointsService, ReferralService,│
│    NotificationService, AuditService.                        │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Repository                                               │
│    backend/src/repositories/submission.repository.ts        │
│    Prisma queries. No decisions, no rules.                  │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
              Prisma ──▶ SQLite (edurewards.db)
                           │
                           ▼  response travels back up
┌─────────────────────────────────────────────────────────────┐
│ 10. Back in React                                           │
│     onSuccess → toast + queryClient.invalidateQueries()      │
│     → affected screens refetch → UI updates                 │
└─────────────────────────────────────────────────────────────┘
```

## The rules that keep this clean

| Rule | Why |
|---|---|
| Routes contain **no** logic | A route is a URL and a guard list. Nothing else. |
| Controllers contain **no** business rules | They translate HTTP ↔ service calls. If you see an `if` about points in a controller, it belongs in a service. |
| Services contain **no** raw Prisma outside their domain | They call repositories. This keeps queries findable and testable. |
| Repositories contain **no** business rules | They answer "get me X", never "should X happen". |
| React components contain **no** business logic | They render state and fire mutations. |

**If you're about to write a rule, it goes in a service.** That's the single most
important convention in this codebase.

## Why layering matters here specifically

This is a financial application. Points have monetary value — the Super Admin
liability page literally computes rupee exposure. So:

- Business rules in **one place** means there is exactly one answer to
  "under what conditions are points awarded?"
- Transactions in **services** means a partial financial operation is impossible.
- Queries in **repositories** means a slow query has one place to be optimised.

## Response envelope

Every API response, success or failure, has the same shape:

```jsonc
// Success
{
  "success": true,
  "data":    { /* the actual payload */ },
  "meta":    { /* optional: pagination, counts */ }
}

// Failure
{
  "success": false,
  "error": {
    "code":      "VALIDATION_ERROR",
    "message":   "The request could not be processed",
    "details":   { "email": "Enter a valid email address" },
    "requestId": "9f2a-…"    ← correlates with the server log
  }
}
```

Built by `backend/src/utils/response.ts` (success) and
`backend/src/middleware/errorHandler.ts` (failure).
Unwrapped by `frontend/src/api/client.ts`, which throws a typed `ApiError`
so components never have to check `success` themselves.

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Input failed a Zod schema. `details` maps field → message |
| `AUTHENTICATION_ERROR` | 401 | Not signed in, or the session expired |
| `AUTHORIZATION_ERROR` | 403 | Signed in, but the role is insufficient |
| `NOT_FOUND` | 404 | The record does not exist |
| `CONFLICT` | 409 | Duplicate — email taken, URL already submitted |
| `BUSINESS_RULE_ERROR` | 400 | The request was well-formed but breaks a rule (insufficient points, budget exhausted, limit reached) |
| `RATE_LIMIT` | 429 | Too many requests |
| `EXTERNAL_SERVICE_ERROR` | 502 | An upstream service failed |
| `INTERNAL_ERROR` | 500 | Unexpected. Stack trace is **never** exposed in production |

`BUSINESS_RULE_ERROR` is the one you will add most often. It means "you asked
for something legitimate-looking that the domain does not permit".
---

# 5. The data model

**File: `backend/prisma/schema.prisma`** — this is the best single file to read
first. Everything else follows from it.

SQLite has no native enum type, so enums are modelled as constrained strings.
The canonical allowed values live in `shared/constants/index.ts` and are enforced
by Zod at the API boundary.

## Entity relationship overview

```
                          ┌──────────────┐
                          │ Institution  │  (multi-org foundation)
                          └──────┬───────┘
                                 │
    ┌────────────────────────────▼─────────────────────────────┐
    │                          User                            │
    │  email · phone · passwordHash · primaryRole · status      │
    │  riskScore · emailVerifiedAt · deletedAt                  │
    └──┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬─────┘
       │    │    │    │    │    │    │    │    │    │    │
       │    │    │    │    │    │    │    │    │    │    └─▶ SupportTicket
       │    │    │    │    │    │    │    │    │    └──────▶ RiskFlag / RiskEvent
       │    │    │    │    │    │    │    │    └───────────▶ Notification
       │    │    │    │    │    │    │    └────────────────▶ PayoutProfile / KycRecord
       │    │    │    │    │    │    └─────────────────────▶ UserTier / UserBadge / Streak
       │    │    │    │    │    └──────────────────────────▶ Redemption ──▶ VoucherCode
       │    │    │    │    └───────────────────────────────▶ Wallet  (derived balances)
       │    │    │    └────────────────────────────────────▶ PointsLedger  ★ source of truth
       │    │    └─────────────────────────────────────────▶ PostSubmission ──▶ PostReview
       │    └──────────────────────────────────────────────▶ ReferralCode
       └───────────────────────────────────────────────────▶ ReferralRelation (parent edge)
                                                            ReferralClosure  (ancestor table)
```

## The models that carry the most weight

### `User`
The identity record. Note three things:

- `primaryRole` is a string, one of `USER` / `ADMIN` / `SUPER_ADMIN`.
  **It is re-read from the database on every request** — a token minted before a
  demotion stops working immediately.
- `deletedAt` is a soft delete. Deleted users are excluded from every query via
  `deletedAt: null`, but their ledger and audit rows survive for financial integrity.
- `riskScore` is an accumulating integer. Each raised risk flag increments it.

### `PointsLedger` ★
**This is the most important table in the system.** Read this section carefully.

```prisma
model PointsLedger {
  id              String   @id @default(uuid())
  userId          String
  transactionType String   // REFERRAL_BONUS | POST_REWARD | LEVEL_BONUS | …
  points          Int      // SIGNED: positive = credit, negative = debit
  balanceAfter    Int      // snapshot of available balance after this row
  level           Int?     // referral level, for LEVEL_BONUS rows
  sourceType      String   // SUBMISSION | REDEMPTION | REFERRAL | ADMIN | SYSTEM | PAYOUT
  sourceId        String   // the id of the thing that caused this
  originUserId    String?  // whose action generated it (a downline member)
  description     String
  expiresAt       DateTime?

  /// THE IDEMPOTENCY GUARANTEE
  @@unique([userId, transactionType, sourceType, sourceId])
}
```

Four properties make this trustworthy:

1. **Append-only.** No code path anywhere updates or deletes a ledger row.
   Corrections are *new* rows of type `REVERSAL` or `MANUAL_CREDIT`/`MANUAL_DEBIT`.
2. **Idempotent by construction.** That `@@unique` constraint means approving
   the same submission twice cannot create two credits. It is a database
   guarantee, not an application check that someone might forget.
3. **Signed amounts.** A credit is `+1000`, a debit is `-1000`. Summing the
   column gives the balance. No separate debit/credit columns to get confused.
4. **Traceable.** `sourceType` + `sourceId` say exactly what caused every row.
   `originUserId` says whose activity generated a referral bonus.

**The invariant:** `sum(ledger.points for a user) === wallet.availablePoints`

The end-to-end test in `backend/tests/redemption.test.ts` asserts this explicitly.

### `Wallet`
A materialised cache of balances, for read performance only.

```prisma
model Wallet {
  availablePoints Int  // spendable right now
  pendingPoints   Int  // submissions awaiting review
  lockedPoints    Int  // held against an open redemption
  redeemedPoints  Int  // permanently spent
  expiredPoints   Int  // lapsed
  lifetimeEarned  Int  // all-time gross earnings
  version         Int  // increments on every write
}
```

**It is only ever written by `PointsService.award()`**, inside the same
transaction that appends a ledger row. Nothing else touches it. That is why it
can be trusted despite being derived.

### `ReferralRelation` and `ReferralClosure`

Two tables, two jobs.

**`ReferralRelation`** is the direct parent edge — one row per user, saying who
referred them. `childId` is `@unique`, which is what makes a parent immutable.

**`ReferralClosure`** is a *closure table*. It stores one row for every
ancestor/descendant pair, plus a depth-0 self row.

For the chain `A → B → C → D`:

| ancestorId | descendantId | depth |
|---|---|---|
| A | A | 0 |
| A | B | 1 |
| A | C | 2 |
| A | D | 3 |
| B | B | 0 |
| B | C | 1 |
| B | D | 2 |
| C | C | 0 |
| C | D | 1 |
| D | D | 0 |

**Why bother?** Without it, "find everyone above D, in order, up to 4 levels"
requires a recursive query — four round trips, or a recursive CTE. With it,
it's one indexed lookup:

```sql
SELECT * FROM ReferralClosure
WHERE descendantId = 'D' AND depth > 0 AND depth <= 4
ORDER BY depth ASC
```

That query runs on every single approval. It has to be fast.

Inserting a new member copies the parent's ancestry and increments depth — see
`referralRepository.linkClosure()` in
`backend/src/repositories/referral.repository.ts`.

### `PostSubmission`

```prisma
model PostSubmission {
  postUrl          String
  normalisedUrl    String   @unique   ← duplicate protection lives here
  status           String   // DRAFT|PENDING|UNDER_REVIEW|INFO_REQUESTED|APPROVED|REJECTED|REVERSED|EXPIRED
  livenessFailures Int      // consecutive definitive failures
}
```

`normalisedUrl` is the post URL with tracking parameters stripped, host
lowercased and `www.`/`m.` removed — see `backend/src/utils/url.ts`. Because it
is `@unique`, two people cannot claim the same post even if one of them adds
`?utm_source=whatsapp`.

### `VoucherCode`

```prisma
model VoucherCode {
  code         String
  status       String   // UNUSED | RESERVED | ASSIGNED | USED | EXPIRED
  redemptionId String?  @unique   ← a code can back at most one redemption

  @@unique([rewardId, code])      ← no duplicate codes in a pool
}
```

Two unique constraints do the heavy lifting. Assignment uses a conditional
`updateMany` (`voucherRepository.claimNext`) so two concurrent approvals cannot
win the same row — the second one's update matches zero rows and it tries again
or fails cleanly.

### `AuditLog`

```prisma
model AuditLog {
  actorId    String?   // who did it (null = system)
  actorRole  String?
  action     String    // e.g. "submission.approved"
  entityType String
  entityId   String?
  beforeJson String?   // state before, sensitive fields redacted
  afterJson  String?   // state after
  ip         String?
  userAgent  String?
}
```

Write-only from the application's perspective. There is no update or delete
path. The Super Admin audit page renders a readable before/after diff.

`backend/src/services/audit.service.ts` strips sensitive keys (`passwordHash`,
`accountNumber`, `panNumber`, tokens) from snapshots before they are stored.

### `AppSetting`

Key/value configuration. This is where economics live:

| Key | Default | Controls |
|---|---|---|
| `referral.levelPercentages` | `[20,10,5,2.5]` | % paid at each level |
| `referral.maxDepth` | `4` | How many levels earn |
| `referral.signupBonus` | `1000` | Points for a direct referral joining |
| `points.inrConversion` | `0.1` | 1 point = ₹0.10 |
| `points.expiryDays` | `365` | 0 disables expiry |
| `redemption.minimumPoints` | `1000` | Floor for any redemption |
| `submission.dailyLimit` | `5` | Submissions per user per day |
| `points.monthlyEarnCap` | `100000` | 0 removes the cap |
| `payout.minimumAmount` | `500` | Minimum cash payout in ₹ |
| `payout.tdsPercent` | `0` | Tax deduction |
| `liveness.failureThreshold` | `3` | Consecutive failures before reversal |
| `voucher.lowStockThreshold` | `5` | Triggers a staff alert |

Read through `SettingsService.getEconomics()`, which caches for 15 seconds.
**Nothing in the codebase hardcodes "four levels" or "20%".**

## Index strategy

Indexes exist where the query patterns actually are:

| Table | Index | Serves |
|---|---|---|
| `User` | `email`, `phone` (unique) | Login, duplicate detection |
| `User` | `status`, `primaryRole`, `createdAt` | Admin user list filters |
| `ReferralClosure` | `[descendantId, depth]` | **Find ancestors** — runs on every approval |
| `ReferralClosure` | `[ancestorId, depth]` | Find downline — network page |
| `PointsLedger` | `[userId, createdAt]` | Wallet ledger, paginated |
| `PointsLedger` | `[sourceType, sourceId]` | Reversal — find all rows from one source |
| `PostSubmission` | `[status, submittedAt]` | Verification queue, oldest first |
| `PostSubmission` | `normalisedUrl` (unique) | Duplicate detection |
| `Redemption` | `[status, createdAt]` | Admin redemption queue |
| `VoucherCode` | `[rewardId, status]` | Claim next available code |
| `Notification` | `[userId, readAt]` | Unread badge count |
| `AuditLog` | `[entityType, entityId]`, `[actorId, createdAt]` | Audit filters |

---

# 6. Business rules that matter

This section explains the rules a maintainer must understand before changing
anything. Each one names the file that enforces it.

## 6.1 Points are never double-credited

**File: `backend/src/services/points.service.ts` → `award()`**

```
award() is called
      ↓
Look for an existing ledger row matching
(userId, transactionType, sourceType, sourceId)
      ↓
   Found? ──── yes ──▶ Log a warning. Return { duplicate: true }.
      │                 Nothing is written. No error is thrown.
      no
      ↓
Compute the wallet delta for this transaction type
      ↓
Reject if ANY bucket would go negative
      ↓
Write wallet + append ledger row, in the caller's transaction
```

Two layers of protection:
1. The application checks first and returns gracefully.
2. The `@@unique` index would reject it anyway if the check were bypassed.

**When you add a new way to award points, you must supply a stable
`sourceType`/`sourceId` pair.** If you generate a random id each time, you have
disabled the protection. Look at how `verification.service.ts` uses the
submission id — it is deterministic and reused.

## 6.2 No wallet bucket can go negative

**File: `backend/src/services/points.service.ts` → `applyDelta()`**

Every transaction type maps to a set of bucket movements:

| Transaction | available | locked | redeemed | lifetimeEarned |
|---|---|---|---|---|
| `POST_REWARD` | `+points` | — | — | `+points` |
| `REFERRAL_BONUS` / `LEVEL_BONUS` | `+points` | — | — | `+points` |
| `REDEMPTION_LOCK` | `−points` | `+points` | — | — |
| `REDEMPTION_DEBIT` | — | `−points` | `+points` | — |
| `REFUND` | `+points` | — | — | `+points` |
| `REVERSAL` | `−points` | — | — | `−points` |
| `EXPIRY` | `−points` | — | — | — |

After computing the new values, every bucket is checked:

```ts
for (const [bucket, value] of Object.entries(next)) {
  if (value < 0) throw new BusinessRuleError(`…negative ${bucket}…`);
}
```

This is why a user cannot redeem more points than they hold, even if two
redemption requests arrive at the same instant. The second one computes a
negative available balance and the whole transaction rolls back.

## 6.3 Approval is one atomic transaction

**File: `backend/src/services/verification.service.ts` → `approve()`**

```
prisma.$transaction(async (tx) => {
   1. submission.status = APPROVED, record reviewer + timestamp
   2. PostReview row (the audit trail for this state change)
   3. PointsService.award()   → POST_REWARD to the poster
   4. ReferralService.distribute() → one LEVEL_BONUS per eligible ancestor
   5. campaign.budgetSpentPoints += (base + all distributed points)
   6. Notification to the poster
   7. Notification to each ancestor who earned
})
```

If step 5 throws, steps 1–4 are rolled back. There is **no state** in which an
ambassador is credited but their upline is not, or a budget is consumed without
a matching award.

Two checks happen **before** the transaction opens:
- Campaign budget still has room (re-checked at decision time, not just at
  submission time — the budget may have been consumed by other approvals in between)
- The poster is within their monthly earning cap

Two things happen **after** the transaction, deliberately outside it:
- Tier/badge refresh (`gamificationService.refreshForUser`) — a failure here
  must not roll back someone's points
- Audit log write

## 6.4 The referral ladder

**File: `backend/src/services/referral.service.ts` → `distribute()`**

```
A qualifying event happens (a post is approved for 1,000 points)
      ↓
Read economics: levelPercentages = [20, 10, 5, 2.5], maxDepth = 4
      ↓
Query the closure table for ancestors, depth 1..4, ordered by depth
      ↓
For each ancestor:
   ├─ Is their account ACTIVE?          no → skip (suspended users don't earn)
   ├─ Is earningsPaused on their edge?  yes → skip
   ├─ points = floor(1000 × percent / 100)
   ├─ PointsService.award(LEVEL_BONUS, level=depth)
   └─ Notify them
      ↓
Record a PointsDistribution summary row for auditability
```

For a 1,000-point post with the default ladder:

| Level | % | Points |
|---|---|---|
| Poster | — | 1,000 |
| 1 (direct referrer) | 20% | 200 |
| 2 | 10% | 100 |
| 3 | 5% | 50 |
| 4 | 2.5% | 25 |
| **Total cost** | | **1,375** |

That 1,375 is what is deducted from the campaign budget — not just the 1,000.
The Economics page shows this total cost so a Super Admin can see the real
per-post expense before changing percentages.

## 6.5 Referral integrity

**File: `backend/src/services/referral.service.ts` → `attach()`**

| Rule | How it is enforced |
|---|---|
| Codes are unique | Unique index + retry-on-collision loop (8 attempts, then error) |
| No self-referral | Explicit `parentId === childId` check |
| No circular referral | `isDescendant(childId, parentId)` — if the prospective parent is already *below* the child, refuse |
| Parent is immutable | `ReferralRelation.childId` is `@unique`; a second attach throws `ConflictError` |
| Suspension preserves the tree | Sets `earningsPaused = true`. **The tree is never restructured.** |
| Deletion re-parents | `reparentChildren()` moves direct children to the deleted user's parent and rebuilds only the affected closure rows |

The suspension rule deserves emphasis. It would be tempting to remove a
suspended user from the tree — but that would silently change the earnings of
everyone below them, who did nothing wrong. Instead the structure is frozen and
only *their* earning is paused.

## 6.6 Submission validation

**File: `backend/src/services/submission.service.ts` → `create()`**

Checks run in this order (cheapest first):

1. **Platform matches the URL.** A LinkedIn URL submitted as Instagram is rejected
   (`utils/url.ts → platformMatchesUrl`).
2. **Daily limit.** Count of today's submissions vs `submission.dailyLimit`.
3. **Campaign accepts it** (`campaignService.assertAcceptingSubmissions`):
   - Status is `ACTIVE`
   - Today is inside the date window
   - The platform is on the campaign's list
   - The budget can cover another credit
   - The user is under the per-campaign limit
4. **Duplicate URL.** The URL is normalised, then checked against the unique index:
   - Same user, previously rejected → allowed (this is a resubmission)
   - Same user, still open → `ConflictError`
   - **Different user → `ConflictError` AND a `DUPLICATE_URL` risk flag is raised**

That last case is the important one. Someone claiming another person's post is
not a typo — it is fraud, and it is recorded as such.

## 6.7 Redemption and voucher assignment

**File: `backend/src/services/redemption.service.ts`**

```
CREATE                                APPROVE
──────                                ───────
Validate reward is active             Convert the lock to a permanent debit
Validate ≥ minimum redemption         Claim the next UNUSED voucher code
Validate sufficient balance           Decrement reward stock
Validate stock available              status → FULFILLED (or APPROVED if manual)
      ↓ transaction                   Notify the user
Create Redemption (POINTS_LOCKED)           ↓ all in one transaction
REDEMPTION_LOCK: available → locked
Notify the user

REJECT
──────
REFUND row: returns points to available
Clear the locked bucket
Release any reserved voucher
status → REJECTED with a reason
Notify the user
```

**Voucher assignment cannot double-assign.**
`voucherRepository.claimNext()` finds a candidate, then runs:

```ts
updateMany({ where: { id: candidate.id, status: 'UNUSED' }, data: { status: 'ASSIGNED', … } })
```

If another request claimed it microseconds earlier, `status` is no longer
`UNUSED`, the update matches **zero** rows, and this request gets `null` back →
clean `BusinessRuleError` instead of a duplicate code.

There is a test for exactly this: three concurrent approvals against a two-code
pool must produce exactly two successes and one clean failure.

## 6.8 Reversal

**File: `backend/src/services/points.service.ts` → `reverseBySource()`**

When an approved post is removed:

```
Find every ledger row with sourceType=SUBMISSION, sourceId=<id>
  (this is the poster's POST_REWARD *and* every ancestor's LEVEL_BONUS)
      ↓
For each: create a compensating REVERSAL row with the opposite sign
      ↓
Record a PointsReversal link (original → reversal)
      ↓
Submission status → REVERSED
      ↓
Raise a risk flag + notify the user
```

The original rows are **never modified**. After a reversal the ledger shows both
the award and its compensation, so the history remains explainable.

## 6.9 Post liveness — deliberately conservative

**Files: `backend/src/jobs/liveness.job.ts`, `backend/src/integrations/social/adapter.ts`**

The adapter contract is the important part:

```ts
/**
 * Must return UNKNOWN (never REMOVED) for network errors, timeouts or
 * rate limits. Only a definitive "this page no longer exists" returns REMOVED.
 */
checkLiveness(url: string): Promise<'ALIVE' | 'REMOVED' | 'UNKNOWN'>
```

The job then:

| Result | Action |
|---|---|
| `ALIVE` | Reset `livenessFailures` to 0 |
| `UNKNOWN` | Record the attempt. **Do not count it as a failure.** |
| `REMOVED` | Increment `livenessFailures`. Reverse only when it reaches the configured threshold (default 3) |

A single bad network day, a rate limit, or a 503 can never cost an ambassador
their points — or, worse, cost their entire upline theirs.

## 6.10 Economics changes are forward-only

**File: `backend/src/services/settings.service.ts` → `updateEconomics()`**

Changing the conversion rate or referral percentages updates `AppSetting` rows.
It does **not** recompute historical ledger entries. This is deliberate:

- Past balances stay stable — a user's wallet doesn't change because an admin
  adjusted a setting.
- Liability reporting for past periods remains defensible.
- The audit log records the before/after of every economics change.

The confirmation dialog on the Economics page states this explicitly to the
Super Admin before they save.
---

# 7. Backend, layer by layer

## 7.1 `config/` — boot-time setup

### `env.ts`
Validates every environment variable with Zod **before the app starts**.

```ts
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);   // fail fast — never boot misconfigured
}
```

This is why a missing `JWT_SECRET` gives you a clear list of problems rather
than a confusing runtime crash three requests later.

**To add a new setting:** add it to `envSchema`, add it to `.env.example` with a
comment, and it is immediately available as `env.YOUR_SETTING` with the right type.

### `prisma.ts`
The singleton Prisma client, plus SQLite pragmas applied on boot:

```ts
PRAGMA foreign_keys = ON;    // SQLite has FK enforcement OFF by default (!)
PRAGMA journal_mode = WAL;   // concurrent reads during a write
PRAGMA busy_timeout = 5000;  // wait rather than fail on lock contention
```

The `foreign_keys` pragma matters a lot — without it SQLite silently accepts
orphaned rows.

### `logger.ts`
Pino, with a **redaction list**:

```ts
redact: {
  paths: ['req.headers.authorization', 'req.headers.cookie',
          '*.password', '*.passwordHash', '*.token', '*.tokenHash',
          '*.panNumber', '*.accountNumber', '*.refreshToken'],
  censor: '[redacted]',
}
```

If you add a new sensitive field, add it here too.

## 7.2 `middleware/` — the request pipeline

Applied in this order in `app.ts`:

| Middleware | File | Does |
|---|---|---|
| `helmetMiddleware` | `security.ts` | Security headers |
| `corsMiddleware` | `security.ts` | Origin allowlist, credentials enabled |
| `compression` | — | gzip responses |
| `express.json` | — | Body parsing, 1 MB limit |
| `cookieParser` | — | Reads the refresh cookie |
| `requestContext` | `requestContext.ts` | Assigns a request id, logs method/path/status/duration |
| `csrfGuard` | `security.ts` | Double-submit check, **only** for cookie-authenticated mutations |
| `globalLimiter` | `rateLimit.ts` | 300 requests/minute by default |

Then per-route:

| Middleware | Does |
|---|---|
| `authenticate` | Verifies the JWT **and re-reads role + status from the database** |
| `requireMinRole('ADMIN')` | Hierarchical role check |
| `requireVerifiedEmail()` | Blocks unverified accounts from submitting/redeeming |
| `validate(schema, 'body'\|'query')` | Zod parse; **replaces** the payload with the parsed result |
| `authLimiter` | 10 attempts / 15 min on credential endpoints |
| `writeLimiter` | 60 / min on expensive writes |
| `screenshotUpload.single()` | Multer, MIME-validated, UUID filenames |

### A note on `validate()`

```ts
req.validated = { ...req.validated, [source]: result.data };
if (source === 'body') req.body = result.data;
```

It **overwrites** the raw payload with the parsed, coerced result. Downstream
code therefore cannot accidentally read unvalidated input — `req.body` *is* the
validated object. Controllers use `validated<T>(req)` to get it with types.

### A note on `authenticate()`

```ts
// Role and status are re-read from the database on every request: a token
// minted before a demotion or suspension must never keep working.
const user = await prisma.user.findFirst({ where: { id: payload.sub, deletedAt: null }, … });
if (user.status === 'SUSPENDED') throw new AuthorizationError(…);
```

This costs one indexed lookup per request and buys immediate revocation. There
is a test asserting a valid token stops working the moment the account is
suspended.

## 7.3 `repositories/` — data access only

One file per aggregate. Every method either returns data or writes data.
**No decisions.**

Two conventions worth knowing:

**1. Transaction-aware.** Most methods accept an optional client:

```ts
create(data, db: Tx | typeof prisma = prisma) { return db.pointsLedger.create({ data }); }
```

Called normally it uses the global client; called inside
`prisma.$transaction(tx => …)` it joins that transaction. This is what lets a
service compose several repositories into one atomic operation.

**2. List methods return a consistent shape:**

```ts
async list(filters) {
  const { page, pageSize, skip, take } = toSkipTake(filters);
  const where = { /* built from filters */ };
  const [items, total] = await Promise.all([
    prisma.model.findMany({ where, skip, take, orderBy, include }),
    prisma.model.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
```

The service then wraps it with `paginate()` to produce the API's
`{ items, pagination }` envelope.

**Sort safety:** where sorting is user-controllable, the column is checked
against an allowlist (`const SORTABLE = new Set([...])`) before being used.

## 7.4 `services/` — all business logic

21 services. The ones you will touch most:

| Service | Owns |
|---|---|
| `points.service.ts` | **Award, reverse, adjust.** The financial core |
| `referral.service.ts` | Codes, attachment, closure, distribution, tree, stats |
| `verification.service.ts` | Approve / reject / request info / reverse / bulk |
| `submission.service.ts` | Creation, validation, queue shaping |
| `redemption.service.ts` | Lock, approve, reject, fulfil, timeline |
| `voucher.service.ts` | Import, atomic assign, inventory, reveal |
| `settings.service.ts` | Economics read/write, caching |
| `risk.service.ts` | Flag raising, signal scoring, resolution |
| `analytics.service.ts` | All three dashboards, chart-ready data |
| `audit.service.ts` | Immutable audit writes with redaction |
| `notification.service.ts` | In-app + pluggable channels |

### `PointsService` is the one to understand

Its public surface is small on purpose:

```ts
award(input, tx)                              // the only way points move
reverse(ledgerId, reason, actorId, tx)        // compensating entry
reverseBySource(sourceType, sourceId, …, tx)  // reverse a whole chain
manualAdjustment({ userId, adminId, … }, tx)  // admin credit/debit
assertWithinEarningCap(userId, incoming)      // monthly cap guard
```

`award()` **requires a transaction** as its last argument. That signature is
deliberate — it makes it impossible to move points outside a transaction by
accident.

### Services compose each other

```
VerificationService.approve()
      ├── SubmissionRepository.update()
      ├── PointsService.award()           ← the poster's credit
      ├── ReferralService.distribute()     ← which itself calls PointsService.award()
      │                                        once per eligible ancestor
      ├── CampaignRepository.incrementSpend()
      ├── NotificationService.create()
      └── AuditService.record()
```

All of that inside one `prisma.$transaction`.

## 7.5 `controllers/` — thin translation

A controller should be boring:

```ts
async approve(req: Request, res: Response) {
  const { note } = validated<{ note?: string }>(req);
  return ok(res, await verificationService.approve(
    req.params.id, req.auth!.userId, { note }, ctx(req),
  ));
}
```

Read validated input → call the service → wrap the result. That's it.
The `ctx(req)` helper builds the audit context (actor, role, IP, user agent).

If you find yourself writing an `if` about business state in a controller, that
logic belongs in a service.

## 7.6 `routes/` — paths and guards

```ts
router.use(authenticate, requireMinRole('ADMIN'));

router.get('/', validate(submissionQuerySchema, 'query'), asyncHandler(submissionController.queue));
router.post('/:id/approve', validate(submissionDecisionSchema), asyncHandler(submissionController.approve));
router.post('/:id/reverse', requireMinRole('SUPER_ADMIN'), validate(reasonSchema), asyncHandler(submissionController.reverse));
```

You can read the entire authorization model by reading the route files. That is
the point — security decisions are visible in one place rather than scattered
through handlers.

`asyncHandler()` wraps async handlers so a rejected promise reaches the error
middleware instead of hanging the request.

## 7.7 `jobs/` — background work

| Job | Default interval | Does |
|---|---|---|
| `liveness.job.ts` | 6 hours | Re-checks approved posts, reverses confirmed removals |
| `pointsExpiry.job.ts` | 12 hours | Expires credits past their expiry date |
| `leaderboard.job.ts` | 1 hour | Rebuilds monthly and all-time rankings |
| `voucherStock.job.ts` | 6 hours | Notifies staff about low code pools |
| `campaignLifecycle.job.ts` | 30 min | `SCHEDULED → ACTIVE → COMPLETED` by date |

`scheduler.ts` is intentionally simple: `setInterval` with overlap protection
(a job that is still running is skipped rather than started again) and
`.unref()` so it never blocks shutdown.

**Handlers are plain async functions with no scheduler coupling.** Moving to
BullMQ or a managed queue means changing only how they are *invoked*, not the
jobs themselves.

Disable all jobs with `ENABLE_JOBS=false` — useful in tests and when running
multiple instances where only one should run scheduled work.

## 7.8 `integrations/` — the adapter pattern

```ts
export interface SocialAdapter {
  readonly key: string;
  supports(platform: string): boolean;
  checkLiveness(url: string): Promise<'ALIVE' | 'REMOVED' | 'UNKNOWN'>;
}
```

`httpAdapter.ts` is the generic fallback. To add a proper Instagram Graph API
adapter, implement the interface and call `registerAdapter(yourAdapter)` — the
job picks it up with no changes.

---

# 8. Frontend, layer by layer

## 8.1 `api/client.ts` — the single fetch wrapper

Everything HTTP goes through here. Three things it handles so nothing else has to:

**1. The access token is memory-only.**
```ts
let accessToken: string | null = null;
```
Not `localStorage`. An XSS payload cannot read a variable in a module closure as
easily as it can read storage, and a page refresh re-derives it from the
httpOnly refresh cookie.

**2. Silent refresh on 401, with request collapsing.**
```ts
if (response.status === 401 && !isRetry) {
  const refreshed = await attemptRefresh();   // collapses concurrent 401s into one call
  if (refreshed) return execute(path, options, true);
  setAccessToken(null);
  onUnauthorized?.();   // clears the store, router sends the user to /login
}
```
If five queries 401 at once, exactly one refresh request is made.

**3. Envelope unwrapping.**
Success returns `data` directly. Failure throws a typed `ApiError` carrying
`code`, `status`, `details` and `requestId`. Components never check
`response.success`.

## 8.2 `api/queryClient.ts` — cache config and query keys

**Every query key in the application is defined here**, in one object:

```ts
export const queryKeys = {
  wallet:   { summary: ['wallet'], ledger: (f) => ['wallet','ledger',f], … },
  campaigns:{ list: (f) => ['campaigns', f], detail: (id) => ['campaigns', id] },
  …
};
```

Why centralise: invalidation becomes reliable. After approving a submission:

```ts
queryClient.invalidateQueries({ queryKey: ['verifications'] });
queryClient.invalidateQueries({ queryKey: ['analytics'] });
```

Because keys are hierarchical and consistent, that one call refreshes the queue,
the stats card and the dashboards. Stringly-typed keys scattered across files
make this impossible to get right.

**Retry policy:** never retry a deliberate 4xx.
```ts
retry: (count, error) => {
  if (error instanceof ApiError && error.status < 500 && error.status !== 429) return false;
  return count < 2;
}
```
Retrying a 422 or a 403 is pointless and confusing.

## 8.3 `store/` — deliberately small

Zustand holds only genuinely global state:

**`authStore.ts`** — current user, auth status (`loading` / `authenticated` /
`anonymous`), and the token setter.

**`uiStore.ts`** — theme, sidebar open state, toasts, online status.

**Server data is NOT in the store.** It lives in TanStack Query, which handles
caching, refetching, loading and error states properly. Putting API data in a
global store means reimplementing all of that badly.

## 8.4 `components/ui/` — the design system

About 40 components. The rule: **a page never defines a button, input, card,
chip or table.** It imports them.

| Group | Components |
|---|---|
| Actions | `Button`, `IconButton` |
| Forms | `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `SearchInput` |
| Containers | `Card`, `CardHeader`, `CardBody`, `CardFooter` |
| Status | `StatusChip`, `Chip`, `PointsBadge`, `TrendPill`, `SlaChip` |
| Data | `DataTable`, `Pagination`, `FilterBar`, `StatCard`, `StatGrid` |
| Charts | `ChartCard`, `TrendChart`, `ColumnChart`, `LineSeriesChart`, `DonutChart` |
| Overlays | `Dialog`, `ConfirmDialog`, `Drawer` |
| States | `EmptyState`, `ErrorState`, `Skeleton`, `AsyncBoundary`, `TableSkeleton` |
| Misc | `Avatar`, `ProgressBar`, `Breadcrumb`, `Tabs`, `Timeline`, `PageHeader`, `Toaster`, `ImageLightbox` |

### Three components worth studying

**`AsyncBoundary`** — makes a blank screen impossible:

```tsx
<AsyncBoundary query={query} skeleton={<DashboardSkeleton />} empty={<EmptyState … />}>
  {(data) => <YourContent data={data} />}
</AsyncBoundary>
```
Handles loading → error (with retry) → empty → success in one place.

**`DataTable`** — one table implementation, used by every list screen.
It handles loading, error, empty, pagination, sorting, row clicks, bulk
selection, **and automatically becomes stacked cards below 768px**:

```tsx
const columns: Column<Row>[] = [
  { key: 'name',   header: 'Name',   render: (r) => r.name, primary: true },
  { key: 'points', header: 'Points', render: (r) => <PointsBadge points={r.points} />, numeric: true },
  { key: 'ip',     header: 'IP',     render: (r) => r.ip, hideOnMobile: true },
];
```
- `primary: true` → stays prominent in the mobile card view
- `hideOnMobile: true` → dropped entirely on small screens
- `numeric: true` → right-aligned, tabular figures

**`Overlay` (Dialog/Drawer)** — shared `useOverlay` hook gives every modal:
escape-to-close, focus trapping, focus restore on close, and background scroll
lock. Accessibility is handled once, not per-modal.

## 8.5 `styles/tokens.css` — theming

**Every colour, radius, shadow and spacing value in the app resolves through a
CSS variable declared here.** Components never contain a hex code.

```css
:root {
  --primary: #14532D;
  --background: #F7F9FB;
  --card: #FFFFFF;
  --foreground: #0F172A;
  --border: #E5E7EB;
  /* …plus status, chart, typography, radii, shadows, motion */
}

[data-theme='dark'] {
  --primary: #34D399;
  --background: #0B1220;
  --card: #111A2B;
  --foreground: #E8EEF6;
  --border: #1E293B;
}
```

This is why dark mode works everywhere without touching a single component.
`uiStore` sets `document.documentElement.dataset.theme` and the whole app
re-themes.

## 8.6 `features/` — one folder per product area

```
features/submissions/
├── api.ts                    ← typed API calls for this feature
├── SubmitPostPage.tsx
├── MySubmissionsPage.tsx
├── SubmissionDetailPage.tsx
└── components/               ← components only this feature uses
```

A feature folder owns only what belongs to it. Anything two features need moves
up into `components/ui/` or `hooks/`.

## 8.7 `routes/` — route table and guards

`routes/index.tsx` is the complete site map. **Every page is lazily loaded**, so
the initial bundle contains only what is needed to render the login screen.

```tsx
{ element: <RequireAuth />, children: [
    { element: <AppLayout />, children: [
        { path: '/dashboard', element: <DashboardPage /> },
        { element: <RequireRole minimum="ADMIN" />, children: [
            { path: '/admin/verifications', element: <VerificationQueuePage /> },
        ]},
        { element: <RequireRole minimum="SUPER_ADMIN" />, children: [
            { path: '/super-admin/audit', element: <AuditPage /> },
        ]},
    ]},
]}
```

### The guards (`routes/guards.tsx`)

| Guard | Behaviour |
|---|---|
| `RequireAuth` | Anonymous → `/login`, **preserving the intended destination** in router state so login redirects back |
| `RequireRole` | Wrong role → `/403`, **not** `/login` (you are signed in; you just lack permission) |
| `RedirectIfAuthenticated` | Signed-in users never see login/signup |
| `HomeRedirect` | `/` routes by role, and sends incomplete users to `/onboarding` |

That 403-vs-login distinction matters for UX: sending a signed-in admin to a
login page because they clicked a Super Admin link is confusing.

> **The frontend guards are UX, not security.** Every endpoint independently
> enforces its own authorization. Removing the guard in DevTools just gets you a
> 403 from the API.

## 8.8 `hooks/` — shared behaviour

**`useFilters`** — every list screen uses this. It keeps filter state **in the
URL**, so a filtered view is shareable and survives refresh:

```ts
const { filters, setFilter, setPage, reset, searchInput, setSearchInput, activeCount } = useFilters({ status: 'PENDING' });
```
- Search input is debounced (350ms) so typing doesn't fire a request per keystroke
- Changing any filter resets to page 1 (page 4 of a new filter is meaningless)
- `activeCount` drives the "Clear filters" button

**`useBadgeCounts`** — one polled query feeds every navigation badge, rather
than each nav item mounting its own request.

**`useMediaQuery` / `useIsMobile`** — drives the `DataTable` card/table switch.
---

# 9. API reference

Base URL: `/api/v1` · Interactive docs: `http://localhost:4000/api/docs`

**Auth:** send `Authorization: Bearer <accessToken>` from `/auth/login`.
The refresh token is an httpOnly cookie and is handled automatically.

Legend: 🔓 public · 👤 any signed-in user · 🛡️ `ADMIN`+ · 👑 `SUPER_ADMIN` only

## Auth — `/auth`

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/register` | 🔓 | Create an account (optionally with a referral code) |
| POST | `/login` | 🔓 | Sign in, returns access token + sets refresh cookie |
| POST | `/refresh` | 🔓 | Rotate the refresh token, get a new access token |
| POST | `/logout` | 👤 | Revoke the current session |
| GET | `/me` | 👤 | Current user profile |
| POST | `/verify-email` | 🔓 | Consume an email verification token |
| POST | `/resend-verification` | 👤 | Issue a new verification link |
| POST | `/forgot-password` | 🔓 | Request a reset link (always reports success) |
| POST | `/reset-password` | 🔓 | Complete a reset; revokes all sessions |
| POST | `/change-password` | 👤 | Change while signed in |
| GET | `/referral/:code` | 🔓 | Preview who a referral code belongs to |

## Users — `/users`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/me` | 👤 | Full own profile with wallet and referral stats |
| PATCH | `/me` | 👤 | Update own profile |
| POST | `/me/onboarding` | 👤 | Advance the onboarding step |
| GET | `/` | 🛡️ | Paginated user list with filters |
| GET | `/:id` | 🛡️ | Full user detail |
| PATCH | `/:id/status` | 🛡️ | Activate / suspend / deactivate |
| POST | `/:id/points` | 🛡️ | Manual point adjustment (reason required) |
| PATCH | `/:id/role` | 👑 | Change a role |
| GET | `/staff` | 👑 | List administrators with throughput |
| POST | `/staff` | 👑 | Create an administrator |
| DELETE | `/:id` | 👑 | Soft delete with referral re-parenting |

## Referrals — `/referrals`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/me` | 👤 | Code, link, clicks, signups, per-level stats |
| GET | `/tree` | 👤 | Nested network tree with contributions |
| GET | `/analytics` | 👤 | Stats + top performers + leaderboard |
| GET | `/:userId` | 👤 | Subtree (own network only, unless staff) |

## Campaigns — `/campaigns`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | 👤 | List. Ambassadors always see active-only, regardless of query params |
| GET | `/:id` | 👤 | Detail with rules, creatives, hashtags, own submission count |
| POST | `/` | 🛡️ | Create |
| PATCH | `/:id` | 🛡️ | Update |
| PATCH | `/:id/status` | 🛡️ | Change status |
| POST | `/:id/creatives` | 🛡️ | Upload a creative asset |

## Submissions — `/submissions` (ambassador view)

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/` | 👤 ✉️ | Submit a post (multipart, optional screenshot) |
| GET | `/` | 👤 | Own submissions, filtered |
| GET | `/:id` | 👤 | Detail with review history (internal notes hidden) |

✉️ = requires a verified email address.

## Verification — `/verifications` (staff view)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | 🛡️ | Review queue with SLA banding |
| GET | `/stats` | 🛡️ | Queue counts and aging breakdown |
| GET | `/:id` | 🛡️ | Detail **with risk signals and user history** |
| POST | `/:id/claim` | 🛡️ | Mark as under review by you |
| POST | `/:id/approve` | 🛡️ | Approve → award points + distribute referrals |
| POST | `/:id/reject` | 🛡️ | Reject (reason required) |
| POST | `/:id/request-info` | 🛡️ | Ask the ambassador for more detail |
| POST | `/:id/reverse` | 👑 | Reverse an approved submission and its whole chain |
| POST | `/bulk/approve` | 🛡️ | Bulk approve, per-item results |
| POST | `/bulk/reject` | 🛡️ | Bulk reject |

## Wallet — `/wallet`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | 👤 | All balances + estimated INR value |
| GET | `/ledger` | 👤 | Paginated ledger with filters |
| GET | `/trend` | 👤 | Daily earned/redeemed series, zero-filled |

## Rewards and redemptions

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/rewards` | 👤 | Catalogue with affordability per reward |
| GET | `/rewards/:id` | 👤 | Detail with stock and balance-after |
| POST | `/rewards` | 🛡️ | Create a reward |
| DELETE | `/rewards/:id` | 👑 | Archive (blocked if redemptions are open) |
| POST | `/redemptions` | 👤 ✉️ | Redeem — locks points |
| GET | `/redemptions` | 👤 | Own redemptions |
| GET | `/redemptions/:id` | 👤 | Detail with progress timeline |
| POST | `/redemptions/:id/voucher` | 👤 | **Reveal own voucher code** (owner only) |
| GET | `/redemptions/admin` | 🛡️ | Admin queue |
| POST | `/redemptions/:id/approve` | 🛡️ | Approve → debit + assign voucher |
| POST | `/redemptions/:id/reject` | 🛡️ | Reject → refund points |

## Vouchers — `/vouchers`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | 🛡️ | Inventory overview with low-stock flags |
| GET | `/:id` | 🛡️ | Pool detail (codes **masked**) |
| POST | `/:id/codes` | 👑 | Bulk import codes (CSV or JSON array) |

## Payouts and KYC — `/payouts`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/profile` | 👤 | Own payout details, **masked** |
| PUT | `/profile` | 👤 | Save payout details (encrypted at rest) |
| POST | `/kyc` | 👤 | Upload a KYC document |
| POST | `/requests` | 👤 | Request a cash payout |
| GET | `/admin/requests` | 🛡️ | Payout queue |
| POST | `/admin/requests/:id/decide` | 🛡️ | Approve or reject |
| POST | `/admin/kyc/:id/review` | 🛡️ | Verify or reject KYC |

## Everything else

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/analytics/dashboard` | 👤 | Ambassador dashboard, one call |
| GET | `/analytics/admin` | 🛡️ | Operations dashboard |
| GET | `/analytics/super-admin` | 👑 | Platform + liability dashboard |
| GET | `/notifications` | 👤 | Paginated, with unread count |
| PATCH | `/notifications/read-all` | 👤 | Mark all read |
| GET | `/risk` | 🛡️ | Risk flag queue |
| POST | `/risk/:id/resolve` | 🛡️ | Dismiss or action a flag |
| GET | `/audit` | 👑 | Immutable audit log with filters |
| GET | `/settings/economics` | 👤 | Current economics (read) |
| PATCH | `/settings/economics` | 👑 | **Change economics** |
| GET | `/reports` | 🛡️ | Available report definitions |
| GET | `/reports/:key/export` | 🛡️ | Download CSV |
| GET | `/gamification/leaderboard` | 👤 | Rankings |
| POST | `/support` | 👤 | Raise a ticket |
| GET | `/support/inbox` | 🛡️ | Ticket inbox |
| POST | `/announcements` | 🛡️ | Publish an announcement |
| GET | `/health` `/health/ready` | 🔓 | Liveness / readiness |

---

# 10. How do I — the cookbook

This is the section to use when you need to change something. Each recipe names
the exact files.

---

## 10.1 Change the referral percentages or depth

**No code change needed.**

Sign in as Super Admin → **Economics** (`/super-admin/settings/economics`).

Adjust the level percentages, max depth, signup bonus or conversion rate. The
page shows you the **total cost per approved post** before you save, and the
confirm dialog reminds you that changes are forward-only.

*If you need more than the current number of level inputs:* the array length is
driven by whatever is stored in `referral.levelPercentages`. Seed a longer array
in `backend/prisma/seed.ts` (or patch the setting via the API) and the UI renders
the extra inputs automatically.

---

## 10.2 Add a new social platform (e.g. Threads, Snapchat)

Four small edits:

**1.** `shared/constants/index.ts`
```ts
export const PLATFORMS = ['INSTAGRAM','FACEBOOK','LINKEDIN','X','YOUTUBE','TELEGRAM','THREADS'] as const;
```

**2.** `backend/src/utils/url.ts` — teach URL detection about the host
```ts
const HOST_MAP: Record<string, Platform> = {
  …,
  'threads.net': 'THREADS',
};
```

**3.** (optional) `backend/src/integrations/social/` — add a dedicated liveness
adapter if the generic HTTP one isn't accurate for that platform.

**4.** Nothing else. Campaign forms, submission steps, filters and validation all
read from `PLATFORMS`.

---

## 10.3 Add a new reward category

**Option A — through the database (preferred):**
```sql
INSERT INTO RewardCategory (id, key, name, sortOrder)
VALUES (lower(hex(randomblob(16))), 'GAMING', 'Gaming', 7);
```

**Option B — in the seed**, so fresh installs have it:
`backend/prisma/seed.ts`, in the `categories` array.

The `REWARD_CATEGORIES` constant in `shared/constants/index.ts` is documentation;
the database table is what the API and UI actually read.

---

## 10.4 Add a completely new API endpoint

Worked example: "let admins export a single user's ledger".

**Step 1 — repository** (`backend/src/repositories/ledger.repository.ts`)
```ts
allForUser(userId: string) {
  return prisma.pointsLedger.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}
```

**Step 2 — service** (`backend/src/services/wallet.service.ts`)
```ts
async exportForUser(userId: string, ctx: AuditContext) {
  const rows = await ledgerRepository.allForUser(userId);
  // Exporting someone else's financial history is sensitive — audit it.
  await auditService.record({ ...ctx, action: 'wallet.exported', entityType: 'User', entityId: userId });
  return toCsv(rows.map((r) => ({
    date: r.createdAt.toISOString(), type: r.transactionType,
    points: r.points, balance: r.balanceAfter, description: r.description,
  })));
}
```

**Step 3 — controller** (`backend/src/controllers/user.controller.ts`)
```ts
async exportLedger(req: Request, res: Response) {
  const csv = await walletService.exportForUser(req.params.id, ctx(req));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ledger-${req.params.id}.csv"`);
  return res.send(csv);
}
```

**Step 4 — route** (`backend/src/routes/user.routes.ts`)
```ts
router.get('/:id/ledger/export', requireMinRole('ADMIN'), asyncHandler(userController.exportLedger));
```

**Step 5 — document it** in `backend/src/docs/openapi.ts`.

**Step 6 — frontend** (`frontend/src/features/users/api.ts`)
```ts
exportLedger: (id: string) => api.download(`/users/${id}/ledger/export`),
```

Then call it with `downloadBlob()` from a button on the user detail page.

**Never skip a layer.** A route calling Prisma directly will work today and
become unmaintainable in three months.

---

## 10.5 Add a new page to the frontend

Worked example: an ambassador "Achievements" page.

**1.** Create `frontend/src/features/gamification/AchievementsPage.tsx`
```tsx
export default function AchievementsPage() {   // ← must be a default export (lazy loading)
  const query = useQuery({ queryKey: queryKeys.gamification.profile, queryFn: … });
  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Achievements" subtitle="Badges, tiers and streaks" />
      <AsyncBoundary query={query} skeleton={<Skeleton height={300} />}>
        {(data) => <YourContent data={data} />}
      </AsyncBoundary>
    </div>
  );
}
```

**2.** Register the lazy import and route in `frontend/src/routes/index.tsx`
```tsx
const AchievementsPage = lazy(() => import('@/features/gamification/AchievementsPage'));
…
{ path: '/achievements', element: <AchievementsPage /> },
```

**3.** Add navigation in `frontend/src/layouts/navigation.tsx`
```ts
{ to: '/achievements', label: 'Achievements', icon: icons.leaderboard },
```

**4.** Add the page title in `frontend/src/layouts/AppLayout.tsx` → `TITLES`
```ts
{ match: /^\/achievements/, title: 'Achievements', subtitle: 'Your badges and tier progress' },
```

---

## 10.6 Change the colour scheme / rebrand

**One file: `frontend/src/styles/tokens.css`.**

```css
:root {
  --primary: #1E3A8A;        /* your brand colour */
  --primary-hover: #1E40AF;
  --accent-soft: #EFF6FF;    /* a very light tint of primary */
  --accent-mint: #DBEAFE;
}
[data-theme='dark'] {
  --primary: #60A5FA;        /* lighter for contrast on dark */
  --accent-soft: #172554;
}
```

Because no component contains a hex code, that is the whole change. Also update
`theme_color` in `frontend/vite.config.ts` (PWA manifest) and the `<meta name="theme-color">`
in `frontend/index.html`.

**Logo:** the mark lives inline in `frontend/src/layouts/Sidebar.tsx` and
`AuthLayout.tsx`, plus `frontend/public/favicon.svg`.

---

## 10.7 Add a field to an existing model

Worked example: a `nickname` on `Profile`.

**1.** `backend/prisma/schema.prisma`
```prisma
model Profile {
  …
  nickname String?
}
```

**2.** Migrate
```bash
npm run db:migrate
```

**3.** Allow it through validation — `shared/schemas/index.ts`
```ts
export const profileUpdateSchema = z.object({
  …,
  nickname: z.string().trim().max(40).optional(),
});
```

**4.** The service already spreads profile data, so no service change is needed.
Verify in `backend/src/services/user.service.ts → updateProfile()`.

**5.** Add the input to `frontend/src/features/settings/SettingsPage.tsx`
```tsx
<Input label="Nickname" {...register('nickname')} />
```

---

## 10.8 Add a new background job

**1.** Create `backend/src/jobs/yourJob.job.ts`
```ts
export async function yourJob() {
  // Return a summary object — it is logged on completion.
  return { processed: 0 };
}
```

**2.** Register it in `backend/src/jobs/index.ts`
```ts
{ name: 'your-job', intervalMinutes: 60, runOnBoot: false, handler: yourJob },
```

Two things the scheduler gives you free: overlap protection (a job still running
is skipped, not stacked) and error isolation (a throw is logged, not fatal).

**Make jobs idempotent.** They may run twice — on restart, or if you later scale
to multiple instances. Use the same `sourceType`/`sourceId` discipline as
`PointsService`.

---

## 10.9 Add a new risk signal

**1.** `shared/constants/index.ts` → add to `RISK_TYPES`

**2.** `backend/src/services/risk.service.ts` → add a weight
```ts
const WEIGHTS = { …, YOUR_SIGNAL: 20 };
```

**3.** Raise it from wherever it is detected
```ts
await riskService.raiseFlag({
  userId, type: 'YOUR_SIGNAL', severity: 'HIGH',
  summary: 'A human-readable explanation of what was detected',
  evidence: { relevantData: 123 },
});
```

Flags are idempotent per `(user, type)` — a repeat detection increments the
existing flag's score rather than creating a duplicate. The risk queue, filters
and the reviewer's signal list pick it up automatically.

---

## 10.10 Send email for real (instead of console logging)

`backend/src/services/notification.service.ts` already defines the abstraction:

```ts
export interface NotificationChannel {
  readonly key: string;
  send(payload: { to: string; title: string; body: string; type: NotificationType }): Promise<void>;
}
```

Implement it and register:

```ts
const smtpChannel: NotificationChannel = {
  key: 'smtp',
  async send({ to, title, body }) {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject: title, text: body });
  },
};
registerChannel(smtpChannel);
```

Channel sends are fire-and-forget — an SMTP outage must never roll back a
points transaction. WhatsApp and SMS follow the same pattern.

---

## 10.11 Migrate from SQLite to PostgreSQL

The repository layer isolates this. The change is small:

**1.** `backend/prisma/schema.prisma`
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**2.** `backend/.env`
```
DATABASE_URL="postgresql://user:pass@localhost:5432/edurewards"
```

**3.** Remove the SQLite pragmas from `backend/src/config/prisma.ts`
(`initDatabase()`) — Postgres enforces foreign keys natively.

**4.** `npm run db:migrate`

**5.** Consider promoting the string-enum columns to real Postgres enums. Not
required, but you get database-level validation.

No service, controller or route changes.

---

## 10.12 Change the SLA thresholds

`shared/constants/index.ts`
```ts
export const SLA_WARNING_HOURS = 24;
export const SLA_CRITICAL_HOURS = 72;
```

Used by `submission.service.ts` (queue banding) and `analytics.service.ts`
(dashboard stats). Changing them updates the queue chips, the aging counters and
the admin dashboard together.

---

## 10.13 Add a new report

`backend/src/services/report.service.ts` — reports are **data, not code paths**:

```ts
{
  key: 'your-report',
  label: 'Your Report',
  columns: ['id', 'name', 'value'],
  async build({ from, to }) {
    const rows = await prisma.yourModel.findMany({ where: { createdAt: { gte: from, lte: to } } });
    return rows.map((r) => ({ id: r.id, name: r.name, value: r.value }));
  },
}
```

That's it. It appears in the reports list, previews in the UI, and exports to
CSV — no new endpoint, no new page.

---

## 10.14 Debug "why did this user get these points?"

1. **Admin → Users → the user → Ledger tab.** Every row states its type,
   description and source.
2. `LEVEL_BONUS` rows carry a `level` — that tells you how far down the tree the
   triggering activity was.
3. `originUserId` on the ledger row identifies *whose* activity caused it.
4. **Super Admin → Audit Log**, filter by entity id, to see the approval that
   started it, including before/after state.
5. Or query directly:
```bash
npm run db:studio     # then browse PointsLedger filtered by userId
```

---

## 10.15 Reset everything and start fresh

```bash
npm run db:reset      # drops, re-migrates, re-seeds
```

To wipe uploads too:
```bash
rm -rf backend/uploads/* && touch backend/uploads/.gitkeep
```
---

# 11. Security model

## 11.1 Authentication

```
Sign in
   ├─▶ Access token   — JWT, 15 min, held in a JS variable (memory only)
   └─▶ Refresh token  — opaque 48 random bytes, httpOnly cookie,
                        stored server-side as a SHA-256 hash

Access token expires
   ├─▶ Client silently POSTs /auth/refresh (cookie travels automatically)
   ├─▶ Server rotates: old token revoked, new one issued, same "family"
   └─▶ Original request is retried once

An already-rotated refresh token is presented  ← token theft signal
   ├─▶ The ENTIRE token family is revoked
   ├─▶ An audit record is written
   └─▶ The user must sign in again
```

**Why the access token is not in `localStorage`:** anything in storage is
readable by any script on the page. A module-scoped variable is meaningfully
harder to exfiltrate, and losing it on refresh is fine because the httpOnly
cookie can mint a new one.

**Why refresh tokens are hashed server-side:** a database leak does not hand an
attacker usable sessions.

## 11.2 Passwords

- bcrypt, cost factor 12
- Never returned by any endpoint; the register test asserts the response body
  contains neither the plaintext nor the hash
- Never logged (the Pino redaction list covers `password` and `passwordHash`)
- Account locks for 15 minutes after 5 failed attempts
- Changing or resetting a password revokes **all** refresh tokens

**No account enumeration:** an unknown email and a wrong password produce the
identical error message and status. `forgot-password` always reports success.

## 11.3 Authorization

Two independent layers:

**Server (the real one).** Every route declares its requirement:
```ts
router.post('/:id/reverse', requireMinRole('SUPER_ADMIN'), …);
```
`authenticate` re-reads role and status from the database on every request, so a
token issued before a demotion or suspension stops working immediately.

**Client (UX only).** Route guards keep users out of areas they cannot use, but
bypassing them in DevTools just produces a 403 from the API.

Ownership is enforced where it matters:
- `submissionService.detail()` — non-staff can only read their own
- `redemptionService.detail()` — same
- `voucherService.revealForUser()` — a code is revealed to its owner and nobody else
- `referralController.treeFor()` — a user may only inspect subtrees they own

## 11.4 Data protection

| Data | At rest | In API responses | In logs |
|---|---|---|---|
| Password | bcrypt hash | Never | Redacted |
| Refresh token | SHA-256 hash | Cookie only | Redacted |
| Bank account | **AES-256-GCM encrypted** | `XXXX XXXX 1234` | Redacted |
| PAN | **AES-256-GCM encrypted** | `XXXXX234F`, Super Admin only | Redacted |
| UPI ID | Plain (needed for matching) | `ab****@bank` | Redacted |
| Voucher code | Plain (it *is* the value) | Masked except owner reveal | Not logged |

Encryption lives in `backend/src/utils/crypto.ts`, keyed by `ENCRYPTION_KEY`.
Format: `iv.authTag.ciphertext`, base64url.

> ⚠️ Rotating `ENCRYPTION_KEY` makes existing payout details unreadable. Plan a
> re-entry flow before changing it in production.

## 11.5 Input validation

Every request body, query string and route parameter passes a Zod schema before
reaching a controller. The middleware **replaces** the payload with the parsed
result, so unvalidated input is unreachable downstream.

File uploads:
- MIME type allowlist per upload type (images for screenshots, images+PDF for KYC)
- Size cap from `MAX_UPLOAD_MB`
- **Filenames are regenerated from a UUID** — the client-supplied name is used
  only to read an extension, and even that is sanitised

## 11.6 Other protections

| Threat | Mitigation |
|---|---|
| SQL injection | Prisma parameterises everything; the two raw queries use bound parameters |
| XSS | React escapes by default; no `dangerouslySetInnerHTML` anywhere |
| CSRF | Double-submit token, enforced only for cookie-authenticated mutations |
| Clickjacking | Helmet frame headers |
| Brute force | `authLimiter`: 10 attempts / 15 min, plus account lockout |
| Request flooding | `globalLimiter`: 300/min, `writeLimiter`: 60/min |
| CSV injection | `utils/csv.ts` prefixes cells starting with `= + - @` with a quote |
| Mass assignment | Zod schemas define exactly which fields are accepted |
| Information leak | Stack traces never returned in production; `requestId` correlates instead |

## 11.7 Pre-deployment checklist

- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are strong **and different**
- [ ] `ENCRYPTION_KEY` is 32+ characters and backed up securely
- [ ] `NODE_ENV=production`
- [ ] `COOKIE_SECURE=true` and the app is served over HTTPS
- [ ] `FRONTEND_URL` is the real origin (CORS depends on it)
- [ ] Seed demo accounts removed or their passwords changed
- [ ] Rate limits reviewed for expected traffic
- [ ] Database file is on a **persistent volume**, and backed up
- [ ] `/health/ready` wired to your orchestrator
- [ ] Log aggregation configured (and verified not to capture redacted fields)

---

# 12. Testing

```bash
npm test                          # everything
npm --workspace backend run test  # API + business logic
npm --workspace frontend run test # components + guards + utils
```

## What the backend tests cover

Tests target the places where a bug costs money.

**`auth.test.ts`**
- Registration hashes the password and never returns it
- Weak passwords are rejected with field-level detail
- Duplicate email is a 409
- Unknown email and wrong password give **identical** responses
- Account locks after repeated failures
- **A valid token stops working the instant the account is suspended**
- All three role boundaries

**`referral.test.ts`**
- A 4-level chain produces correct closure depths `[1,2,3,4]`
- Self-referral is refused
- Circular referral is refused
- A parent cannot be changed once set
- Signup bonus is awarded exactly once
- Suspension pauses earnings **without changing the tree**

**`points.test.ts`**
- Approval awards the poster and distributes the ladder (20% at level 1)
- A second approval of the same submission is refused and creates no second credit
- `award()` with a repeated source returns `duplicate: true` and writes nothing
- Any movement that would cause a negative bucket throws
- Reversal compensates the original **and** every downstream referral bonus,
  leaving the original rows intact
- Budget-exceeding submissions are blocked
- Duplicate URL across users → 409 **and a risk flag**
- Tracking-parameter variants are treated as the same URL
- Per-campaign limits and platform mismatches are enforced

**`redemption.test.ts`**
- Points lock on request, debit on approval
- Over-redemption is refused
- Rejection refunds in full
- **Three concurrent approvals against a two-code pool → exactly two succeed**
- A voucher code is revealed to its owner and nobody else
- Full end-to-end journey: signup → referral → submission → approval → points →
  redemption → voucher, asserting the ledger reconciles with the wallet

## How backend tests work

`tests/setup.ts` points `DATABASE_URL` at a disposable `data/test.db`, deletes
any previous file and runs `prisma db push`. Your development database is never
touched. Tests run single-forked because SQLite is one file.

`tests/helpers.ts` gives you the building blocks:

```ts
await resetDatabase();                       // clean slate + economics seeded
const { body } = await registerUser();       // a new ambassador
const session = await activateAndLogin(body.email);
const admin = await createStaff('ADMIN');
const campaign = await createCampaign({ creditValue: 1000 });
await request(app).post('/api/v1/submissions').set(auth(session.token)).send({…});
```

## Writing a new backend test

```ts
describe('Your feature', () => {
  beforeEach(resetDatabase);

  it('states the business rule as a sentence', async () => {
    const admin = await createStaff('ADMIN');
    const response = await request(app).post('/api/v1/your-endpoint')
      .set(auth(admin.token)).send({ … });

    expect(response.status).toBe(200);
    // Assert the DATABASE state, not just the response.
    const row = await prisma.yourModel.findFirstOrThrow(…);
    expect(row.someField).toBe(expected);
  });
});
```

**Assert database state, not just HTTP status.** A 200 that wrote the wrong row
is worse than a 500.

## Frontend tests

`ui.test.tsx` — loading buttons block clicks, icon buttons have accessible
names, inputs link their errors with `aria-invalid`, `DataTable` shows empty and
error states rather than blank space.

`guards.test.tsx` — the full role matrix: anonymous → login, ambassador → 403 on
admin routes, admin → 403 on super-admin routes, super admin gets everywhere.

`format.test.ts` — Indian number grouping, em-dash for missing values, compact
chart labels.

---

# 13. Deployment

## Local production build

```bash
npm run build                        # builds both workspaces
npm --workspace backend run db:deploy   # applies migrations (no prompts)
npm start
```

Frontend output: `frontend/dist` — plain static files, host anywhere.
Backend output: `backend/dist`.

## Docker

```bash
export JWT_SECRET=... JWT_REFRESH_SECRET=... ENCRYPTION_KEY=...
docker compose up --build
```

Two services: `api` (Node) and `web` (nginx serving the built SPA and proxying
`/api` to the API).

**The database and uploads live on named volumes**, never inside a container
layer. Rebuilding the image cannot destroy the points ledger. Migrations run
automatically on container start.

The `api` service has a healthcheck against `/health/ready`, and `web` waits for
it to pass before starting.

## Backups

The entire database is one file. Back it up with SQLite's own API rather than
`cp`, which can capture a torn write:

```bash
sqlite3 backend/data/edurewards.db ".backup '/backups/edurewards-$(date +%F).db'"
```

Because WAL is enabled, also retain `.db-wal` and `.db-shm` if you copy files
directly. Back up `backend/uploads/` too.

## Scaling considerations

SQLite is a genuinely good fit up to meaningful traffic — WAL gives concurrent
reads during writes. The point to migrate is **sustained write contention**,
which shows up as `SQLITE_BUSY` errors under load.

When that happens, see [§10.11](#1011-migrate-from-sqlite-to-postgresql) — it is
a datasource change, not a rewrite, because repositories isolate data access.

Before migrating, also consider: setting `ENABLE_JOBS=false` on all but one
instance, and moving uploads to object storage (the `publicUrlFor` helper in
`middleware/upload.ts` is the seam).

---

# 14. Troubleshooting

### `Invalid environment configuration` on startup
**Expected behaviour.** The API validates its config and refuses to boot
insecurely. It prints exactly which fields are wrong.
```bash
cp .env.example backend/.env
node scripts/generate-secrets.js   # paste the three values in
```

### `PrismaClientInitializationError` / "table does not exist"
The database has not been created or the schema drifted.
```bash
npm run db:migrate
# still broken?
npm run db:reset
```

### `@prisma/client did not initialize yet`
The generated client is missing or stale — happens after editing the schema.
```bash
npm --workspace backend run db:generate
```

### Frontend loads but every request returns 401
`FRONTEND_URL` in `backend/.env` must match the origin the browser is actually
using. CORS rejects unlisted origins and the browser then refuses to send
credentials.
```
FRONTEND_URL=http://localhost:5173
```
Using a LAN IP? Add it, or set it as the value.

### `SQLITE_BUSY: database is locked`
WAL and a 5-second busy timeout are already enabled. Common causes:
- Prisma Studio holding a write lock → close it
- Tests running against the dev database → check `DATABASE_URL` in `tests/setup.ts`
- Genuine write contention → time to consider PostgreSQL

### Port already in use
```bash
lsof -ti:4000 | xargs kill -9     # or :5173
```
Or change `PORT` in `backend/.env` **and** the proxy target in
`frontend/vite.config.ts`.

### Seed fails partway through
It clears tables in dependency order first, but a partial failure leaves mixed
state.
```bash
npm run db:reset
```

### "Cannot find module '@/…'" or "@shared/…"
Path aliases are configured in **two** places and both must agree:
- `frontend/tsconfig.json` → `compilerOptions.paths`
- `frontend/vite.config.ts` → `resolve.alias`

### Approval fails with "would exceed the campaign budget"
Working as designed. The budget is re-checked at decision time because other
approvals may have consumed it since submission. Either raise the budget on the
campaign, or reject the submission.

### Points look wrong for a user
They almost certainly are not — but to prove it:
1. Admin → Users → the user → **Ledger** tab
2. Sum the `points` column; it must equal the wallet's available balance
3. `LEVEL_BONUS` rows show which level and which downline member triggered them
4. Super Admin → **Audit Log**, filter by entity, to see the originating decision

### Dark mode looks wrong on a component
It is using a hardcoded colour instead of a token. Search for `#` or
`bg-gray`/`text-white` in that component and replace with a `var(--…)` from
`tokens.css`.

### Uploaded images 404
Check `UPLOAD_DIR` exists and is writable, and that `PUBLIC_BASE_URL` matches
where the API is actually reachable — it is used to build the stored URL.

---

# 15. Glossary

| Term | Meaning |
|---|---|
| **Append-only** | Rows are only ever inserted, never updated or deleted. Corrections are new compensating rows |
| **Closure table** | A table storing every ancestor/descendant pair so hierarchy queries are a single indexed lookup |
| **Idempotent** | Doing it twice has the same effect as doing it once |
| **Ledger** | `PointsLedger` — the authoritative record of every point movement |
| **Wallet** | Materialised balances derived from the ledger, written only alongside it |
| **Bucket** | One balance category in a wallet: available, pending, locked, redeemed, expired |
| **Referral ladder** | The list of percentages paid to each level above an earning ambassador |
| **Level / depth** | How many referral hops between two users. Level 1 = direct referrer |
| **Upline / downline** | Ancestors above you / descendants below you |
| **Reversal** | A compensating ledger entry that cancels an earlier one without deleting it |
| **Liveness check** | Re-verifying that an approved post is still publicly visible |
| **SLA banding** | Colour-coding the review queue by age: OK / warning (>24h) / critical (>72h) |
| **Risk flag** | A recorded fraud signal awaiting human review |
| **Risk score** | An accumulating per-user integer; each flag adds its weight |
| **Voucher pool** | The set of unused codes backing a reward |
| **Soft delete** | Marking a row deleted (`deletedAt`) instead of removing it, so history survives |
| **Envelope** | The consistent `{ success, data }` / `{ success, error }` response wrapper |
| **Guard** | A route wrapper that checks authentication or role before rendering |
| **Token rotation** | Issuing a new refresh token on each use and revoking the old one |
| **Token family** | A lineage of rotated refresh tokens; reuse of an old one revokes the whole family |

---

# Appendix A — All npm scripts

Run from the repository root.

| Command | Does |
|---|---|
| `npm install` | Install both workspaces |
| `npm run setup` | Install + generate + migrate + seed |
| `npm run dev` | Start API and frontend together |
| `npm run dev:backend` | API only |
| `npm run dev:frontend` | Frontend only |
| `npm run build` | Production build, both workspaces |
| `npm start` | Run the built API |
| `npm test` | All tests |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run db:migrate` | Create/apply migrations |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `node scripts/generate-secrets.js` | Print strong secret values |

# Appendix B — Where to find things fast

| I want to… | Open |
|---|---|
| Understand the data | `backend/prisma/schema.prisma` |
| Understand points | `backend/src/services/points.service.ts` |
| Understand referrals | `backend/src/services/referral.service.ts` |
| Understand approval | `backend/src/services/verification.service.ts` |
| See every endpoint | `backend/src/routes/index.ts` + `/api/docs` |
| See the authorization model | the `routes/` folder |
| Change colours | `frontend/src/styles/tokens.css` |
| Change navigation | `frontend/src/layouts/navigation.tsx` |
| See every page | `frontend/src/routes/index.tsx` |
| Find a UI component | `frontend/src/components/ui/` |
| Change validation | `shared/schemas/index.ts` |
| Change an enum | `shared/constants/index.ts` |
| Change economics | Super Admin → Economics (no code) |
| Add demo data | `backend/prisma/seed.ts` |
| Add a report | `backend/src/services/report.service.ts` |

---

**Engine internals:** [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
**Quick start:** [`README.md`](../README.md)
**Live API reference:** `http://localhost:4000/api/docs`
