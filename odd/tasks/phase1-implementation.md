# Feature: phase1-implementation

Locator: `odd/tasks/phase1-implementation.md` · Engram topic: `odd/phase1-implementation/tasks`
Design reference: `docs/design.md`

## Objective

Implement the Phase 1 MVP API (product CRUD + auth + Swagger) one supervised task
at a time: each task gets its own branch and PR, and the next one starts only after
the user approves and merges the previous PR.

## Constraints

- TDD by default (RED → GREEN → refactor). Artifacts in English.
- One branch + one PR per task; the user merges.
- No AI attribution in commits; Conventional Commits.
- Agent permissions deny `.env*` files: the user edits env files manually.
- `gh` CLI installed and authenticated: the agent opens PRs (`C:\Program Files\GitHub CLI\gh.exe`).

## Tasks

- [x] T1 — API hardening: env loading, `PORT` validation, listen errors, Postgres on loopback, pagination contract. Route: inline. PR #2 (`chore/api-hardening`), merged.
- [x] T2 — Product domain: fix test fixtures (integer ARS price, typed errors), shared domain errors, `Product.create` GREEN. Route: delegated (writer, 3 files). PR #3 (`feat/product-domain`), merged.
- [x] T3 — Persistence: Drizzle + migrations, `products` table, repository + integration tests against PostgreSQL. Route: delegated (writer, multi-file). PR #4 (`feat/product-persistence`), merged.
- [x] T4 — Use cases: create, update, list (paginated), deactivate; tested with an in-memory repository. Route: delegated (writer, multi-file). PR #5 (`feat/product-use-cases`), merged.
- [x] T5 — HTTP foundation: RFC 9457 error middleware, Zod validation, Swagger generated from Zod; testable startup. Also: `ListProducts` runtime `status` validation (T4 review WARNING). Route: delegated (writer on Sonnet 5.5). Branch `feat/http-foundation`.
- [ ] T6 — Auth: `accounts` table, register + login, bcrypt, JWT 15 min (explained step by step). Also `requireAuth` middleware (verifies the JWT, exposes `ownerId`) so T8 can protect `/products`. Route: delegated (writer on Sonnet 5.5, multi-file: accounts module + migration + http). Branch `feat/auth-register-login`.
- [ ] T7 — Auth: refresh token rotation + reuse detection, logout.
- [ ] T8 — Product endpoints: protected CRUD scoped by `ownerId`, pagination, Swagger docs.

## Progress / Evidence

- T1: `parsePort` 12/12 tests; listen-error and `tsx watch` env flag verified manually; RDD reliability review approved twice.
- T2: RED observed (suite failed to load: missing `./Product.js`); GREEN 32/32 (12 port + 20 product); typecheck clean. `ValidationError` carries `field`; price/stock integer >= 0 (NaN/Infinity/fractions rejected).
- T3: RED observed (restore missing, modules missing); GREEN 50/50 (22 Product, 12 port, 4 testDatabase, 12 repository integration). `db:migrate` applied on dev DB; `d products` shows CHECKs + index. Parent found and fixed (TDD) an ownership hole in `save` upsert: now `setWhere owner_id` + immutable id/owner/createdAt, throws on foreign id. ~650 authored lines (290 tests), above the 400 heuristic due to integration plumbing.
- T4: RED observed (6 suites missing modules, 17 failing: update/deactivate/NotFoundError); GREEN `test:unit` 90/90 without DB, `npm test` 102/102; typecheck clean. Use cases: Create/Get/Update/Deactivate/List (+ shared `findOwnedProduct`); `ListProducts` validates page >= 1 and pageSize 5/10/20, defaults to `active`. Open for T8: `CreateProductRequest.status` (contract) vs always-active create; HTTP maps flat list result to `pagination`. ~876 authored lines (~60% tests).
- T5: RED observed (status cases, app tests, missing errorHandler/startServer); GREEN `test:unit` 111/111, `npm test` 123/123; typecheck clean; smoke: /health, /openapi.json (3.0.3, bearerAuth + ProblemDetails), /docs 200, unknown route 404 problem+json, EADDRINUSE exit 1. zod 4.6.5 + @asteasolutions/zod-to-openapi 9.1.0 (no `extendZodWithOpenApi`; components via `.meta({ id })`). Validated input on `res.locals.validated`. Follow-up: other body-parser client errors (e.g. 413) map to 500. ~600 authored lines.
- T6: RED observed (11 suites missing modules + 4 failing ConflictError/UnauthorizedError tests); GREEN `test:unit` 181/181 without DB; typecheck clean; server smoke: fails fast without `JWT_SECRET`, listens with it. NOT run (Docker daemon down, PostgreSQL unreachable): `npm test` integration (`DrizzleAccountRepository.int.test.ts`, 5 cases) and `db:migrate` of `0001_create_accounts.sql` - environmental, to run before merge. Libs: bcryptjs 3.0.3 (cost 12, pure JS), jose 6.2.12 (HS256, iss `gestoria-api`, 900 s). `LoginAccount` hashes a dummy via the injected hasher on first unknown email (same cost) instead of a hardcoded hash. Migrations live in `apps/api/migrations` (not `drizzle/`). Follow-ups: `products.owner_id` FK to `accounts` (T8), login rate limiting, `requireAuth` not wired to `/products` yet (T8). ~1000 authored lines (~55% tests).

## Next step

After the T6 PR is merged: T7 refresh token rotation + reuse detection, logout.
