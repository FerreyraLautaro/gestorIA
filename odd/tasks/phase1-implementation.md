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
- [x] T6 — Auth: `accounts` table, register + login, bcrypt, JWT 15 min (explained step by step). Also `requireAuth` middleware (verifies the JWT, exposes `ownerId`) so T8 can protect `/products`. Route: delegated (writer on Sonnet 5.5, multi-file: accounts module + migration + http). Branch `feat/auth-register-login`.
- [x] T7 — Auth: refresh token rotation + reuse detection, logout. `refresh_tokens` table (SHA-256 hash only, family id), login sets the httpOnly cookie, `POST /auth/refresh` rotates atomically (sliding 7 days per token), reuse of a revoked token revokes the family, `POST /auth/logout` revokes + clears the cookie. Route: delegated (writer on Sonnet 5.5, multi-file). Branch `feat/auth-refresh-tokens`.
- [ ] T8 — Product endpoints: protected CRUD scoped by `ownerId`, pagination, Swagger docs. User decision (option B): `status` removed from `CreateProductRequest`; products are always created `active`, deactivation only via PATCH/DELETE. Also `products.owner_id` FK to `accounts`. Route: delegated (writer on Sonnet 5.5, multi-file). Branch `feat/product-endpoints`.

## Progress / Evidence

- T1: `parsePort` 12/12 tests; listen-error and `tsx watch` env flag verified manually; RDD reliability review approved twice.
- T2: RED observed (suite failed to load: missing `./Product.js`); GREEN 32/32 (12 port + 20 product); typecheck clean. `ValidationError` carries `field`; price/stock integer >= 0 (NaN/Infinity/fractions rejected).
- T3: RED observed (restore missing, modules missing); GREEN 50/50 (22 Product, 12 port, 4 testDatabase, 12 repository integration). `db:migrate` applied on dev DB; `d products` shows CHECKs + index. Parent found and fixed (TDD) an ownership hole in `save` upsert: now `setWhere owner_id` + immutable id/owner/createdAt, throws on foreign id. ~650 authored lines (290 tests), above the 400 heuristic due to integration plumbing.
- T4: RED observed (6 suites missing modules, 17 failing: update/deactivate/NotFoundError); GREEN `test:unit` 90/90 without DB, `npm test` 102/102; typecheck clean. Use cases: Create/Get/Update/Deactivate/List (+ shared `findOwnedProduct`); `ListProducts` validates page >= 1 and pageSize 5/10/20, defaults to `active`. Open for T8: `CreateProductRequest.status` (contract) vs always-active create; HTTP maps flat list result to `pagination`. ~876 authored lines (~60% tests).
- T5: RED observed (status cases, app tests, missing errorHandler/startServer); GREEN `test:unit` 111/111, `npm test` 123/123; typecheck clean; smoke: /health, /openapi.json (3.0.3, bearerAuth + ProblemDetails), /docs 200, unknown route 404 problem+json, EADDRINUSE exit 1. zod 4.6.5 + @asteasolutions/zod-to-openapi 9.1.0 (no `extendZodWithOpenApi`; components via `.meta({ id })`). Validated input on `res.locals.validated`. Follow-up: other body-parser client errors (e.g. 413) map to 500. ~600 authored lines.

- T6: RED observed (11 suites missing modules + 4 failing ConflictError/UnauthorizedError tests); GREEN `test:unit` 181/181 without DB; typecheck clean; server smoke: fails fast without `JWT_SECRET`, listens with it. Parent verification with Docker up: `db:migrate` applied `0001_create_accounts.sql`; `npm test` 198/198 (25 files, incl. 5 `DrizzleAccountRepository` integration cases); live smoke: register 201, duplicate 409, wrong password 401 problem+json "invalid email or password", login 200 with HS256 JWT (`sub`, `iss`, `exp - iat = 900`). Libs: bcryptjs 3.0.3 (cost 12, pure JS), jose 6.2.12 (HS256, iss `gestoria-api`, 900 s). `LoginAccount` hashes a dummy via the injected hasher on first unknown email (same cost) instead of a hardcoded hash. Migrations live in `apps/api/migrations` (not `drizzle/`). Follow-ups: `products.owner_id` FK to `accounts` (T8), login rate limiting, `requireAuth` not wired to `/products` yet (T8). ~1000 authored lines (~55% tests).
- T7: RED observed (5 unit suites failed to load: missing `Sha256RefreshTokenGenerator`, `RefreshSession`, `Logout`, `RefreshTokenIssuer`, and the new `LoginAccount`/`authRouter` wiring); GREEN `test:unit` 208/208 without DB, `npm test` 235/235 (29 files, 10 new `DrizzleRefreshTokenRepository` integration cases incl. 8 concurrent claims with exactly one winner); typecheck clean; `db:migrate` applied `0002_create_refresh_tokens.sql` (renamed from the generated name, journal tag updated). Decisions: no new libs (cookie parsed by a ~10-line local helper, since only one cookie is read; `res.cookie`/`clearCookie` from Express); `RefreshTokenRepository.rotate` claims with a conditional `UPDATE ... WHERE revoked_at IS NULL AND expires_at > now RETURNING` and inserts the next token in the same transaction, the loser is handled as reuse (family revoked); each login starts a new family; logout revokes only the presented token. `accounts` int test now truncates with `CASCADE` because of the new FK. OpenAPI: `refreshCookie` apiKey scheme, `/auth/refresh`, `/auth/logout`, `Set-Cookie` header on login. ~1100 authored lines (~55% tests). Follow-ups: cleanup job for expired/revoked tokens, rate limiting on `/auth/*`, `Secure` cookie needs HTTPS or localhost for browsers, CSRF is covered by `SameSite=Strict` plus the `/auth` path.
- T8: RED observed (`productsRouter.test.ts` failed to load: missing `productsRouter.js`; FK int cases written against the unmigrated schema). GREEN `test:unit` 261/261 without DB, `npm test` 290/290 (30 files); typecheck clean (api + contracts); `db:migrate` applied `0003_add_products_owner_fk.sql` (renamed from generated name, journal tag updated). Dev DB had 0 products / 0 orphans before the FK; the `_test` DB held 2 stale fixture products that broke its migrate, so only that disposable DB was truncated and the products int test now truncates `accounts CASCADE` in `afterAll`. Live smoke on the real server: register, login, `POST /products` 201 + `Location`, `GET /products` with pagination, no token 401 (smoke rows removed). Decisions: contract `CreateProductRequest` has no `status` (strict body, so `status`/`ownerId` -> 400); `UpdateProductRequest` redefined with explicit `status`; malformed `:id` -> 400 (not 404); FK `ON DELETE RESTRICT`; `CreateProductInput`/`ProductChanges` accept `| undefined` for `exactOptionalPropertyTypes` with Zod output; list `page`/`pageSize` parsed from digit-only strings (OpenAPI shows them as strings with a digit pattern). ~900 authored lines (~65% tests). Follow-ups: rate limiting on `/auth/*`, expired/revoked refresh token cleanup, map body-parser 413 to a 4xx problem, `Secure` cookie needs HTTPS or localhost.

## Next step

Phase 1 complete (T1-T8 merged). Roadmap re-planned in docs/design.md v0.2 (user decision: keep this stack, adopt the SaaS modular v1 business design). Next feature: Phase 1.5 alignment (product sku/minStock/metadata, stock movements, event bus and log) in its own feature document.
