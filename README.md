# EduRewards

**Ambassador Rewards & Referral Platform** — a production-shaped full-stack application.

React + Vite frontend → Node.js REST API → services → repositories → Prisma → SQLite (`edurewards.db`).

---

## Contents

- [What this is](#what-this-is)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Running the app](#running-the-app)
- [Demo accounts](#demo-accounts)
- [Testing](#testing)
- [API documentation](#api-documentation)
- [Production build](#production-build)
- [Deployment with Docker](#deployment-with-docker)
- [Project structure](#project-structure)
- [Key design decisions](#key-design-decisions)
- [Troubleshooting](#troubleshooting)

---

## What this is

Ambassadors register (optionally through a referral link), promote campaigns on social media,
submit their post for verification, and earn points when an administrator approves it. Those
points flow up their referral network across a configurable number of levels, and can be
redeemed for vouchers or cash payouts.

**Three roles:**

| Role | Does |
|---|---|
| `USER` | Refers, submits posts, tracks wallet, redeems rewards, raises tickets |
| `ADMIN` | Verifies submissions, approves redemptions, manages users and campaigns, works the risk queue |
| `SUPER_ADMIN` | Everything above, plus economics, voucher inventory, liability, audit and administrator management |

Every major workflow runs end to end: UI → API → service → database transaction → response → cache
invalidation → UI. There are no decorative buttons and no hardcoded dashboard numbers.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React 18 · Vite · TanStack Query · React Router · Zustand│
│  feature modules · shared design system · PWA shell       │
└───────────────────────────┬──────────────────────────────┘
                            │  REST /api/v1
┌───────────────────────────▼──────────────────────────────┐
│  Express                                                  │
│  Route → Controller → Service → Repository → Prisma        │
│  helmet · CORS · rate limiting · Zod validation · RBAC     │
└───────────────────────────┬──────────────────────────────┘
                            ▼
                  SQLite — backend/data/edurewards.db
```

Full detail, including the points engine invariants and the referral closure table,
is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Prerequisites

- **Node.js 20 or newer** (`node -v`)
- **npm 10 or newer**

No database server is required. SQLite is a file.

---

## Installation

```bash
git clone <your-repo-url> edurewards
cd edurewards

# Installs both workspaces
npm install
```

---

## Environment variables

```bash
cp .env.example backend/.env
node scripts/generate-secrets.js     # prints strong values to paste in
```

At minimum you must set `JWT_SECRET`, `JWT_REFRESH_SECRET` and `ENCRYPTION_KEY`.
**The API refuses to start with a missing or weak configuration** — it validates the
environment with Zod on boot and exits with a list of problems rather than running insecurely.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite path, e.g. `file:./data/edurewards.db` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Token signing. Must differ from each other |
| `ENCRYPTION_KEY` | AES-256-GCM key for bank account and PAN at rest (32+ chars) |
| `FRONTEND_URL` | Used for CORS and referral link generation |
| `ENABLE_JOBS` | Set `false` to disable the background scheduler |
| `SEED_PASSWORD` | Password applied to seeded demo accounts |

> Changing `ENCRYPTION_KEY` after payout details are saved makes those records unreadable.

---

## Database

```bash
npm run db:migrate    # creates edurewards.db and applies migrations
npm run db:seed       # loads three months of internally consistent demo data
npm run db:studio     # optional: browse the data in Prisma Studio
npm run db:reset      # drop, re-migrate and re-seed
```

`npm run setup` does install + generate + migrate + seed in one step.

**The seed is internally consistent, not random noise.** If the ledger says an
ambassador earned 5,000 points, their wallet shows exactly that, the charts have
real shape, and referral bonuses trace back to the submissions that produced them.

It creates: 1 Super Admin, 2 Admins, 25 ambassadors in a genuine 4-level tree,
4 campaigns (one deliberately at its budget ceiling), 60 submissions across all
states, 10 rewards with voucher pools, 15 redemptions, a complete points ledger,
5 support tickets, 3 open risk flags, leaderboards, notifications and audit history.

---

## Running the app

```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:4000 |
| API docs | http://localhost:4000/api/docs |
| Health | http://localhost:4000/health/ready |

Run them separately with `npm run dev:backend` and `npm run dev:frontend`.

---

## Demo accounts

All use the value of `SEED_PASSWORD` (default `EduRewards#2026`).

| Role | Email |
|---|---|
| Super Admin | `admin@edurewards.local` |
| Admin | `ops@edurewards.local` |
| Ambassador | `ambassador@edurewards.local` |

These exist only in the seed script and are configured through the environment —
no password is committed to the repository.

**A five-minute tour:** sign in as the ambassador to see the dashboard, network tree
and wallet ledger. Submit a post. Sign in as `ops@` and approve it from the verification
queue — watch the points and the referral ladder land instantly. Then sign in as `admin@`
to see the same approval reflected in the liability figure and the audit log.

---

## Testing

```bash
npm test                          # both workspaces
npm --workspace backend run test  # API and business logic
```

Backend coverage focuses on the parts where a bug costs money:

- Authentication, password hashing, account lockout, suspension mid-session
- Authorization boundaries for all three roles
- Referral closure depth, self-referral, circular referral, parent immutability
- Points distribution across levels and idempotent awarding
- Double-credit protection, negative-balance prevention, reversal of a full chain
- Duplicate URL detection, including tracking-parameter variants
- Campaign budget and per-user limits
- Redemption locking, refund on rejection, and **concurrent voucher assignment**
- A full end-to-end journey: signup → referral → submission → approval → points → redemption → voucher

Tests run against a disposable `data/test.db`; your development database is untouched.

---

## API documentation

Interactive Swagger UI at **http://localhost:4000/api/docs**, raw spec at `/api/docs.json`.

All responses use one envelope:

```jsonc
// Success
{ "success": true, "data": { }, "meta": { } }

// Error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { }, "requestId": "…" } }
```

Error codes: `VALIDATION_ERROR`, `AUTHENTICATION_ERROR`, `AUTHORIZATION_ERROR`,
`NOT_FOUND`, `CONFLICT`, `BUSINESS_RULE_ERROR`, `RATE_LIMIT`, `EXTERNAL_SERVICE_ERROR`,
`INTERNAL_ERROR`. Stack traces are never returned in production; the `requestId` correlates
a user-facing error with the server log.

---

## Production build

```bash
npm run build
npm --workspace backend run db:deploy
npm start
```

The frontend builds to `frontend/dist` (static files, deployable anywhere).
The backend builds to `backend/dist`.

---

## Deployment with Docker

```bash
export JWT_SECRET=... JWT_REFRESH_SECRET=... ENCRYPTION_KEY=...
docker compose up --build
```

The SQLite file and uploads live on **named volumes**, never inside a container
layer — rebuilding the image cannot destroy the points ledger. Migrations are
applied automatically on container start.

---

## Project structure

```
edurewards/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # complete relational model
│   │   └── seed.ts                # consistent demo dataset
│   ├── data/edurewards.db         # generated
│   └── src/
│       ├── config/                # env validation, prisma, logger
│       ├── controllers/           # request/response shaping only
│       ├── services/              # all business logic
│       ├── repositories/          # data access only
│       ├── routes/                # paths, middleware, RBAC
│       ├── middleware/            # auth, validation, uploads, errors, security
│       ├── validators/            # Zod schemas
│       ├── jobs/                  # liveness, expiry, leaderboards, alerts
│       ├── integrations/social/   # pluggable liveness adapters
│       ├── errors/ utils/ docs/
│       ├── app.ts  server.ts
│       └── tests/
├── frontend/src/
│   ├── api/                       # client, query keys
│   ├── components/ui/             # design system (~40 components)
│   ├── features/                  # auth, dashboard, referrals, campaigns,
│   │                              # submissions, verification, wallet, rewards,
│   │                              # redemptions, vouchers, users, risk, audit,
│   │                              # support, analytics, gamification, settings…
│   ├── layouts/  routes/  hooks/  store/  utils/  styles/
├── shared/                        # types, constants and Zod schemas used by both
├── docker/  docs/  scripts/
```

Each feature folder owns its own `api`, `components`, `hooks` and `pages`.
Shared UI lives in `components/ui` and is never duplicated inside a page.

---

## Key design decisions

**The ledger is the truth.** `PointsLedger` is append-only. A unique index on
`(userId, transactionType, sourceType, sourceId)` makes double-crediting impossible
at the database level, not just in application code. Wallet balances are derived and
only ever written inside the same transaction that appends a ledger row.

**Approval is atomic.** Status change, points award, referral distribution, budget
increment, notification and audit all commit together or not at all.

**Economics are data.** Referral depth, level percentages, conversion rate, limits and
expiry live in `AppSetting`, editable by a Super Admin. Nothing hardcodes "four levels".
Changes apply forward only — history is never rewritten.

**Suspension preserves the network.** Suspending an ambassador pauses their earnings
without restructuring anyone's referral tree.

**Liveness checks are conservative.** A removed-post reversal requires several
*consecutive definitive* failures. Timeouts and rate limits report `UNKNOWN`, so a
transient outage can never cost someone their points.

**Sensitive data is masked by default.** Bank accounts and PAN are AES-256-GCM encrypted
at rest and never returned in full by any endpoint. Voucher codes are masked everywhere
except a deliberate reveal by their owner.

**No offline illusions.** The PWA caches the static shell only. API responses are never
served from cache — a stale balance would be worse than an honest error.

---

## Troubleshooting

**`Invalid environment configuration` on start**
The API validates its config and refuses to boot insecurely. It prints the exact
fields that are missing. Run `node scripts/generate-secrets.js`.

**`PrismaClientInitializationError` / table does not exist**
Run `npm run db:migrate`. If the schema drifted, `npm run db:reset`.

**Frontend loads but every request 401s**
Check `FRONTEND_URL` in `backend/.env` matches where the frontend is actually served.
CORS rejects unlisted origins and credentials will not be sent.

**`SQLITE_BUSY` under load**
WAL mode and a 5-second busy timeout are enabled on boot. Sustained write contention is
the point at which you would migrate to PostgreSQL — only `datasource` and the connection
string change; the repository layer is unaffected.

**Ports already in use**
Change `PORT` in `backend/.env` and the Vite proxy target in `frontend/vite.config.ts`.

**Seed fails partway**
It resets tables in dependency order first. If it fails mid-run, `npm run db:reset`
gives a clean slate.
"# Rewords" 
