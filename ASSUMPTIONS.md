# Assumptions & deliberate deviations

I discovered the actual reference systems in the workspace — the FastAPI service
(`business-sync-backend-services`, incl. the shared 4,698-line `schema.prisma`) and the
React portal (`business-sync-admin-portal`) — and extracted the real contracts from them.
Where the brief and the **live system** disagreed, I followed the live system, because
"wire-compatible with the existing frontend and shared DB" is the non-negotiable goal.
Each such choice is listed below.

## Followed the live system over the brief

| Topic | Brief said | Live system / this service | Why |
|---|---|---|---|
| Refresh cookie name | `bs_refresh` | **`refresh_token`** @ path `/api/v1/auth` | Exact reference cookie; the SPA sends it via `credentials:'include'`. |
| Reset token TTL | 1h | **1h** (env `RESET_TOKEN_EXPIRE_HOURS`, default 1) | Matches the reference settings default (its `.env.example` said 24; the code default is 1). Configurable. |
| Refresh rotation | "rotation + revocation" | **Revocation + session token-binding, no string rotation** | The reference doesn't rotate the token string, and the SPA reuses its stored refresh token (only reads the new `access_token`). Rotating would break the client. I still bind the `Session` to a SHA-256 of its refresh token (`refresh_token_hash`) and verify it — revocation + binding without breaking the client. Skipped when the hash is null (sessions created by the FastAPI service) for shared-DB compat. |
| Cashier grants | `sell, refund, manage_session` | **`sell, refund, customer_orders`** | Verbatim from the reference role seed. |
| Error envelope | `{ detail, code }` | **`{ detail, code }`** (chosen) | The brief mandated this and the SPA parses `detail`. Note: the reference actually emits `{ error, message, details }`; the SPA parses **both**, so this is compatible. It's a one-line change in `errorHandler.ts` to mirror the reference exactly. |

## Stack / structure choices (stated per the brief)

- **Express 4**, not 5 — `hpp` (required) needs a writable `req.query`, which Express 5
  makes read-only. Everything else (asyncHandler pattern, etc.) is identical; upgrading later
  is mechanical.
- **bcryptjs**, not native `bcrypt`/argon2 — pure-JS (no native build in Alpine/CI) and its
  `$2b$` hashes are cross-compatible with the reference's Python `bcrypt`, so both services
  verify each other's `password_hash`.
- **Single `@/*` path alias** (→ `src/*`) instead of many (`@config`, `@common`, …) — one
  mapping to keep in sync across tsconfig / ts-jest / tsc-alias; reads fine (`@/config/env`).
- **`JWT_SECRET`** is the env name (per brief). In a shared deployment it must hold the same
  value as the FastAPI `SECRET_KEY` so tokens verify across both services.
- **RBAC guards live in `common/middleware`** (per brief) and call module services
  (`organizations`, `roles`, `entitlements`). `authGuard` is pure (token only). No import
  cycle: middleware → module services → `infra` + `common/{errors,utils}` (leaves).

## Schema / data

- `prisma/schema.prisma` reproduces the **platform-core subset** (identity, tenancy, RBAC,
  entitlements, files) of the shared schema **verbatim** — singular `@@map` table names
  (`user`, `session`, …), string status columns (no Prisma enums), `refresh_token_hash` on
  `Session`. Business-vertical back-relations are trimmed (Prisma only needs both ends when
  both models are present). In a shared-DB deployment you point `DATABASE_URL` at the live DB
  (or `prisma db pull`); the full schema stays owned by the reference service.
- `/me` `entitlements` returns a **superset** (`status, plan_slug, plan_name, billing_interval,
  modules, features, limits, trial_end, current_period_end, cancel_at_period_end, grace_until`);
  the SPA reads `modules` + `limits`, extra fields are safe.

## Scope boundaries (foundation, extensible)

- **Register** creates a user with `org_id` null (matches the reference); creating/joining an
  org is a separate flow, out of the foundation's scope.
- **`manager_pin`** token helper is included (5m elevation); the full PIN-gated POS override
  flow is left as a module to add.
- Seeded a representative catalog: full `platform.*`, one POS vertical `pos_shop.*`,
  `inventory.*`; system roles Owner/Admin/Manager/Member/Cashier. Other verticals
  (pos_food_service, pos_clothing, ecommerce, ads_manager, chat_manager) follow the identical
  pattern.

## Fixed during live verification

- **Readiness probe hang** — `/readyz` originally hung when Redis was down (ioredis queues
  commands offline). `checkRedis`/`checkDatabase` now race a timeout so `/readyz` returns
  `503` in ~1.5s. Verified live (DB up, Redis down → `{"database":"up","redis":"down"}`).
