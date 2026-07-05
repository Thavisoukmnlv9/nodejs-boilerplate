# Boilerplate API

Production-grade **Node · Express · TypeScript · Prisma** REST API for a multi-tenant POS/commerce SaaS. Wire-compatible with the existing React admin portal and a FastAPI reference service over the same PostgreSQL database — the auth/RBAC contract (token claims, `/me` payload, error shape, permission codes) must not drift.

## Stack

Express 5 · TypeScript · Prisma 7 (PostgreSQL 16) · JWT HS256 + bcryptjs · Zod · helmet · pino · Swagger at `/docs` · Jest + Supertest · multer with pluggable local/S3 storage.

## Quick start

**Prerequisites:** Node ≥ 22, and either Docker or local PostgreSQL 16.

```bash
npm install
cp .env.example .env          # then edit JWT_SECRET, DATABASE_URL, …
npx prisma migrate dev        # create tables + generate the client
npm run prisma:seed:dev       # permission catalog, system roles, demo org + users
npm run dev                   # http://localhost:8080  (docs at /docs)
```

Log in with a seeded demo user (`owner@demo.test` / `Password123`). Smoke test: `curl localhost:8080/healthz`.

**All-in with Docker:** `docker compose up --build` (api + postgres).

## Scripts

| Script | What |
|---|---|
| `npm run dev` | API with hot reload (tsx) |
| `npm run build` / `npm start` | Compile to `dist` / run the compiled API |
| `npm test` | Jest (integration when `RUN_INTEGRATION=1`) |
| `npm run lint` / `format` / `typecheck` | ESLint / Prettier / `tsc --noEmit` |
| `npm run prisma:migrate` / `:studio` / `:reset` | Migrate / GUI / reset |
| `npm run prisma:seed:dev\|uat\|prod` | Environment-specific seed |

## Structure

Feature-based — each module under `src/modules/<name>/` owns its `routes → controller → service → repository → schema`; modules collaborate only through services. Modules: `auth`, `users`, `me`, `files`, `roles`, `organizations`, `branches`, `policies`, `health` (`users` is the template to copy). Shared layers: `access/` (guards, tokens, RBAC), `common/` (middleware, errors, utils), `infra/` (Prisma, email, storage adapters), `config/` (Zod-validated env, permission catalog, logger, Swagger).

## Configuration

All env is validated at boot in [`src/config/env.ts`](src/config/env.ts); see [`.env.example`](.env.example). In a shared deployment with the FastAPI service, `JWT_SECRET` must equal that service's `SECRET_KEY` so tokens verify across both.

---

## Author

**Thavisouk MNLV** — thavisoukmnlv@gmail.com
GitHub: https://github.com/Thavisoukmnlv9

## License

Released under the [MIT License](./LICENSE-MIT). Free for anyone to use, copy, modify,
and distribute — including commercial and company use.

© 2026 Thavisouk MNLV
