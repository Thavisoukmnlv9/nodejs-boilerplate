# Business Sync API

Production-grade **Node / Express / TypeScript / Prisma** REST API — the platform-core
of a multi-tenant POS/commerce SaaS. It is a **wire-compatible reimplementation** of a
proven FastAPI service (`business-sync-backend-services`) and speaks the exact contract
the existing **React admin portal** (`business-sync-admin-portal`) expects, over the
**same PostgreSQL database**.

> The auth + RBAC design is ported from the FastAPI reference and must not drift. Token
> claims/TTLs, the httpOnly refresh cookie, the `/me` payload, permission codes, and the
> error shape are all matched to the live system. See [Wire compatibility](#wire-compatibility).

---

## Architecture

**Feature-based, "a module is a folder."** Each feature (`auth`, `users`, `me`, `files`,
`roles`, `organizations`, `entitlements`, `health`) owns its routes → controller → service
→ repository → schema → types → test. Dependencies point inward:

```
routes → controller (HTTP only) → service (business logic) → repository (data access)
```

Nothing imports another feature's internals — features collaborate through **services**.
Cross-cutting concerns live in shared layers:

- `common/` — middleware, error hierarchy, utils, shared types (the request augmentation)
- `infra/` — Prisma singleton + base repository + transaction helper, email, storage adapters
- `config/` — Zod-validated env, logger, CORS, Swagger, constants, the permission catalog

**Lineage.** The reference service groups code as `core/` (cross-cutting infra),
`platform/` (tenant/identity business logic), and `modules/` (business verticals). This
tree collapses `core/ → common/ + infra/ + config/` and folds `platform/` features into
`src/modules/`, keeping the feature-as-a-folder rule. Business verticals (pos_shop,
pos_food_service, …) are additive: they become new `src/modules/<vertical>/` folders that
reuse the same guards and base classes.

### Folder tree

```
src/
  modules/
    auth/          register · login · refresh · logout · logout-all · forgot/reset · sessions
    users/         org-member CRUD — the template every module copies (authGuard + requirePermission)
    me/            GET /me one-call bootstrap (user, org, permissions, branches, entitlements)
    files/         multipart upload behind the pluggable storage layer
    roles/         list system + org roles (requirePermission)
    organizations/ current-org + the context resolver used by the guards
    entitlements/  subscription → modules/limits/features (in-memory cached); backs requireModule
    health/        /healthz (liveness) · /readyz (readiness: DB)
  common/
    middleware/    requestId · httpLogger · validate · errorHandler · security · rateLimit
                   · authGuard · loadUserOrg · rbac · requireModule · upload · metrics
    errors/        AppError + typed subclasses (NotFound, Unauthorized, Forbidden, …)
    utils/         asyncHandler · pagination · token(JWT) · cookies · password · hash · requestContext
    types/         context.ts + express.d.ts (typed req.auth / req.authContext)
  config/          env.ts (Zod) · logger.ts (pino) · cors.ts · swagger.ts · constants.ts · permissions.ts
  infra/
    prisma/        client singleton · base.repository · transaction
    email/         inline transactional email (password-reset); pluggable provider
    storage/       StorageAdapter interface · local + s3 adapters · driver factory
  api.ts           /api/v1 router (mounts every feature)
  app.ts           builds & wires the Express app (middleware order)
  server.ts        bootstrap + graceful shutdown
prisma/            schema.prisma (platform-core subset) · migrations/ · seed.ts
docker/            Dockerfile (multi-stage, non-root) · entrypoint.sh
```

### Layer responsibilities

| Layer | Responsibility | May import | Must NOT import |
|---|---|---|---|
| `modules/*/routes` | URL → middleware chain → controller | common middleware, own controller/schema | other features' internals |
| `modules/*/controller` | HTTP only (read req, call service, shape res) | own service, errors, cookies | prisma, other repositories |
| `modules/*/service` | business logic, orchestration | own repository, other **services**, errors | express, prisma client directly |
| `modules/*/repository` | data access (the only Prisma callers) | `infra/prisma` | express, http |
| `common/middleware` | cross-cutting request handling | errors, utils, config, module **services** | controllers |
| `infra/*` | DB/email/storage singletons & helpers | config | modules, express |
| `config/*` | validated env, logger, catalog | (leaf) | modules, infra |

---

## Quick start

**Prerequisites:** Node ≥ 20, and either Docker _or_ local PostgreSQL 16.

```bash
npm install
cp .env.example .env          # then edit JWT_SECRET, DATABASE_URL, …
npx prisma migrate dev        # create tables (first run also generates the client)
npm run prisma:seed           # permission catalog, system roles, demo org
npm run dev                   # API on http://localhost:8080  (docs at /docs)
```

Smoke test: `curl localhost:8080/healthz` → `{"status":"ok",…}`.
Log in with the seeded owner (`owner@demo.test` / `Password123`).

**All-in with Docker:**

```bash
docker compose up --build     # api + postgres
```

---

## Scripts

| Script | What |
|---|---|
| `npm run dev` | API with hot reload (tsx) |
| `npm run build` | `tsc` → `dist` + `tsc-alias` (rewrite `@/` aliases) |
| `npm start` | Run the compiled API |
| `npm test` / `test:cov` | Jest (unit; integration when `RUN_INTEGRATION=1`) |
| `npm run lint` / `format` | ESLint / Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:deploy` | `prisma migrate deploy` (production) |
| `npm run prisma:seed` / `:studio` / `:reset` | seed / GUI / reset |
| `npm run docker:build\|up\|down` | compose lifecycle |

---

## Configuration

All env is declared, coerced and **validated at boot** in [`src/config/env.ts`](src/config/env.ts);
nothing else reads `process.env`. A bad config fails fast with a readable message. See
[`.env.example`](.env.example) for every variable. Key ones:

- `JWT_SECRET` (≥ 32 chars) — HS256 signing key. In a **shared deployment** with the
  FastAPI service it must equal that service's `SECRET_KEY` so tokens verify across both.
- `DATABASE_URL`
- `ALLOWED_ORIGINS` (JSON array or CSV; never `*` in prod), `STORAGE_DRIVER` (`local|s3`)
- `ACCESS_TOKEN_EXPIRE_MINUTES=15`, `REFRESH_TOKEN_EXPIRE_DAYS=7`, `RESET_TOKEN_EXPIRE_HOURS=1`

---

## Wire compatibility

Consumed verbatim by the admin portal (`fetch`, `credentials:'include'`, `Authorization: Bearer`):

- **Base path** `/api/v1`. **Success = raw payloads** (no envelope). **Errors = `{ detail, code }`**
  (`detail` is a string, or a FastAPI-style issue array for 422).
- **Tokens** (HS256): access `{sub, org_id?, type:"access"}` 15m · refresh `{sub, session_id,
  type:"refresh"}` 7d · reset `{sub, type:"reset"}` 1h · manager_pin `{sub, org_id,
  type:"manager_pin"}` 5m.
- **Refresh is stateful**: a `Session` row per login; the refresh token carries its
  `session_id`; refresh validates the session (not revoked/expired, user ACTIVE) and is
  revocable (logout, logout-all, password reset). Delivered as an httpOnly, Secure (prod),
  SameSite=strict cookie `refresh_token` scoped to `/api/v1/auth`; read cookie-first, body-fallback.
- **`GET /api/v1/me`** returns `{ user, organization, permissions[], branches[],
  default_branch_id, entitlements{modules,limits,…} }`.
- **RBAC**: permissions are `{module}.{action}` codes granted by the user's role **in the
  current org** (token `org_id`). Guards compose: `authGuard → requireModule(m) →
  requirePermission(code)`.

See [ASSUMPTIONS.md](ASSUMPTIONS.md) for the deliberate deviations from the brief (they favor
the live system) and their rationale.

---

## How to add a new module

1. `src/modules/<feature>/` with `<feature>.{routes,controller,service,repository,schema,types,test}.ts`.
2. Repository extends `BaseRepository` (soft-delete + timestamp helpers, transaction-aware).
3. Controller does HTTP only; wrap handlers in `asyncHandler` and `throw` `AppError`s.
4. Routes compose guards + `validate(schema)`:
   ```ts
   router.post('/orders',
     authGuard, requireModule('pos_shop'), requirePermission('pos_shop.sell'),
     validate({ body: createOrderSchema }), asyncHandler(orderController.create));
   ```
5. Mount it in [`src/api.ts`](src/api.ts) (one `use()` line).

## How to add a permission / role

Both live in [`src/config/permissions.ts`](src/config/permissions.ts):

- **Permission** → add the code string to the relevant `*_CODES` array (shape
  `{module}.{action}`), then `npm run prisma:seed` (idempotent upsert).
- **Role** → add a `RoleSeed` to `SYSTEM_ROLES` (`grants: 'ALL'` or an explicit list); re-seed.
- **New module** → add its code to `MODULE_CODES` and grant it in a plan's `SubscriptionModule`
  rows. Nothing else changes — guards read these dynamically.

## Background work

This service runs in a **single process** — no separate worker, no Redis. The one piece
of async work, the password-reset email, is sent **inline** via
[`src/infra/email/email.service.ts`](src/infra/email/email.service.ts) (pluggable provider;
`console` logs in dev). If background work grows (thumbnailing, bulk exports, retries at
scale), reintroduce a queue behind that same interface — `pg-boss` (Postgres-backed, no new
infra) or BullMQ (needs Redis) — and add a worker entrypoint.

---

## Testing

- **Unit** ([`src/modules/auth/auth.test.ts`](src/modules/auth/auth.test.ts)) — service logic
  with a mocked repository; no infra. Runs anywhere (`npm test`).
- **Integration** ([`tests/users.e2e.test.ts`](tests/users.e2e.test.ts)) — Supertest against
  the real app + test DB, exercising auth → RBAC → users end-to-end. Gated on
  `RUN_INTEGRATION=1` (CI sets it after provisioning Postgres).

---

## How this scales / what to add next

- **Mostly stateless app** — sessions live in Postgres, so the web tier scales
  horizontally. Two things are currently **in-memory / per-instance** and need a shared
  store before multi-instance scale-out: the **rate-limit store** (add `rate-limit-redis`
  or a Postgres store) and the **entitlements cache** (move to Redis). Both are one-file swaps.
- **Deeper multi-tenancy** — add Postgres RLS keyed on `organization_id` as defense-in-depth
  behind the app-level org scoping.
- **Observability** — `/metrics` + request histogram are live; add OpenTelemetry tracing
  around the same request lifecycle (hooks are in place).
- **Feature flags / org-scoped custom roles** — the `Role(organization_id)` and
  `EntitlementOverride` tables already support both; add the write endpoints.
- **Background jobs** — reintroduce a queue (`pg-boss` on Postgres, or BullMQ on Redis) +
  a worker process when async work outgrows inline sending.
- **Blue-green / rolling deploys** — graceful shutdown drains in-flight requests and closes
  the DB on SIGTERM.
- **Remaining POS verticals** — copy the module template; add codes + grants.

**Key trade-offs:** Express 4 (not 5) for full middleware compatibility (`hpp` needs a
writable `req.query`); bcryptjs (pure-JS, hash-compatible with the reference's Python bcrypt);
refresh **revocation without token-string rotation** (the SPA reuses its stored refresh token
— rotating it would break the client), hardened with session token-binding.
