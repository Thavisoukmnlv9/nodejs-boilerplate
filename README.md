# Boilerplate API

Production-grade **Node / Express / TypeScript / Prisma** REST API — the platform-core
of a multi-tenant POS/commerce SaaS. It is a **wire-compatible reimplementation** of a
proven FastAPI service (`boilerplate-backend-services`) and speaks the exact contract
the existing **React admin portal** (`boilerplate-admin-portal`) expects, over the
**same PostgreSQL database**.

> The auth + RBAC design is ported from the FastAPI reference and must not drift. Token
> claims/TTLs, the httpOnly refresh cookie, the `/me` payload, permission codes, and the
> error shape are all matched to the live system. See [Wire compatibility](#wire-compatibility).

---

## Architecture

**Feature-based, "a module is a folder."** Each feature (`auth`, `users`, `me`, `files`,
`roles`, `organizations`, `health`) owns its routes → controller → service → repository
→ schema → types → test. Dependencies point inward:

```
routes → controller (HTTP only) → service (business logic) → repository (data access)
```

Nothing imports another feature's internals — features collaborate through **services**.
Cross-cutting concerns live in shared layers: `common/` (middleware, errors, utils),
`infra/` (Prisma singleton, email, storage adapters), `config/` (validated env, logger,
CORS, Swagger, the permission catalog).

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
    health/        /healthz (liveness) · /readyz (readiness: DB)
  common/          middleware (authGuard, rbac, validate, errorHandler, …) · errors · utils · types
  config/          env.ts (Zod) · logger.ts (pino) · cors.ts · swagger.ts · constants.ts · permissions.ts
  infra/
    prisma/        client singleton · base.repository · transaction
    email/         inline transactional email (password-reset); pluggable provider
    storage/       StorageAdapter interface · local + s3 adapters · driver factory
  api.ts           /api/v1 router (mounts every feature)
  app.ts           builds & wires the Express app (middleware order)
  server.ts        bootstrap + graceful shutdown
prisma/            schema.prisma (platform-core subset) · migrations/
scripts/seed/      seed.ts per environment — dev/ (+ users.ts, roles.ts, permissions.ts split), uat/, prod/
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
npm run prisma:seed:dev       # permission catalog, system roles, demo org
npm run dev                   # API on http://localhost:8080  (docs at /docs)
```

Smoke test: `curl localhost:8080/healthz` → `{"status":"ok",…}`.
Log in with a seeded demo user (`owner@demo.test` / `Password123`).

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
| `npm run prisma:seed:dev\|uat\|prod` | environment-specific seed (see below) |
| `npm run prisma:studio` / `:reset` | GUI / reset |
| `npm run docker:build\|up\|down` | compose lifecycle |

**Seeding.** All three environments share the permission catalog and system roles from
[`src/config/permissions.ts`](src/config/permissions.ts):

- `dev` ([`scripts/seed/dev/`](scripts/seed/dev/)) — catalog + roles + 5 demo users (one
  per system role) + 5 demo organizations with branches, members, sessions, entitlement
  overrides, and files.
- `uat` ([`scripts/seed/uat/seed.ts`](scripts/seed/uat/seed.ts)) — catalog + roles + one
  QA organization with the same 5 test users.
- `prod` ([`scripts/seed/prod/seed.ts`](scripts/seed/prod/seed.ts)) — catalog + roles
  only. No demo data; production accounts come from normal signup.

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
  default_branch_id, entitlements{modules,limits} }`.
- **RBAC**: permissions are `{module}.{action}` codes granted by the user's role **in the
  current org** (token `org_id`). Guards compose: `authGuard → requirePermission(code)`.

---

## How to add a new module

1. `src/modules/<feature>/` with `<feature>.{routes,controller,service,repository,schema,types,test}.ts`.
2. Repository extends `BaseRepository` (soft-delete + timestamp helpers, transaction-aware).
3. Controller does HTTP only; wrap handlers in `asyncHandler` and `throw` `AppError`s.
4. Routes compose guards + `validate(schema)`:
   ```ts
   router.post('/orders',
     authGuard, requirePermission('pos_shop.manage'),
     validate({ body: createOrderSchema }), asyncHandler(orderController.create));
   ```
5. Mount it in [`src/api.ts`](src/api.ts) (one `use()` line).

## How to add a permission / role

Both live in [`src/config/permissions.ts`](src/config/permissions.ts):

- **New module** → add its name to `MODULE_CODES`. It automatically gets every action in
  `MODULE_ACTIONS` (`view`, `create`, `update`, `delete`, `manage`, `reports`) as
  `{module}.{action}` codes — nothing else to write.
- **New action for every module** → add it to `MODULE_ACTIONS`.
- **Platform-only permission** → add the code to `PLATFORM_CODES` (shape `platform.{resource}.{action}`).
- **Role** → add a `RoleSeed` to `SYSTEM_ROLES` (`grants: 'ALL'` or an explicit code list).

Then re-seed (`npm run prisma:seed:dev` etc.) — everything upserts, so it's safe to re-run.

## Background work

This service runs in a **single process** — no separate worker, no Redis. The one piece
of async work, the password-reset email, is sent **inline** via
[`src/infra/email/email.service.ts`](src/infra/email/email.service.ts) (pluggable provider;
`console` logs in dev). If background work grows, reintroduce a queue behind that same
interface — `pg-boss` (Postgres-backed) or BullMQ (needs Redis).

---

## Testing

- **Unit** ([`src/modules/auth/auth.test.ts`](src/modules/auth/auth.test.ts)) — service logic
  with a mocked repository; no infra. Runs anywhere (`npm test`).
- **Integration** ([`tests/users.e2e.test.ts`](tests/users.e2e.test.ts)) — Supertest against
  the real app + test DB, exercising auth → RBAC → users end-to-end. Gated on
  `RUN_INTEGRATION=1` (CI sets it after provisioning Postgres).

---

## What to add next

- **Rate-limit store is in-memory / per-instance** — swap for `rate-limit-redis` or a
  Postgres store before scaling the web tier past one instance.
- **Deeper multi-tenancy** — add Postgres RLS keyed on `organization_id` as defense-in-depth
  behind the app-level org scoping.
- **Observability** — `/metrics` + request histogram are live; OpenTelemetry tracing hooks
  are in place but unused.
- **Feature flags / org-scoped custom roles** — the `Role(organization_id)` and
  `EntitlementOverride` tables already support both; add the write endpoints.
- **Background jobs** — a queue + worker process, once async work outgrows inline sending.

**Key trade-offs:** Express 4 (not 5) for full middleware compatibility (`hpp` needs a
writable `req.query`); bcryptjs (pure-JS, hash-compatible with the reference's Python bcrypt);
refresh **revocation without token-string rotation** (the SPA reuses its stored refresh token
— rotating it would break the client), hardened with session token-binding.
