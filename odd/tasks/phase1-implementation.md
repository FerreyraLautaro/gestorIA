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
- [x] T3 — Persistence: Drizzle + migrations, `products` table, repository + integration tests against PostgreSQL. Route: delegated (writer, multi-file). Branch `feat/product-persistence`.
- [ ] T4 — Use cases: create, update, list (paginated), deactivate; tested with an in-memory repository.
- [ ] T5 — HTTP foundation: RFC 9457 error middleware, Zod validation, Swagger generated from Zod; testable startup.
- [ ] T6 — Auth: `accounts` table, register + login, bcrypt, JWT 15 min (explained step by step).
- [ ] T7 — Auth: refresh token rotation + reuse detection, logout.
- [ ] T8 — Product endpoints: protected CRUD scoped by `ownerId`, pagination, Swagger docs.

## Progress / Evidence

- T1: `parsePort` 12/12 tests; listen-error and `tsx watch` env flag verified manually; RDD reliability review approved twice.
- T2: RED observed (suite failed to load: missing `./Product.js`); GREEN 32/32 (12 port + 20 product); typecheck clean. `ValidationError` carries `field`; price/stock integer >= 0 (NaN/Infinity/fractions rejected).
- T3: RED observed (restore missing, modules missing); GREEN 50/50 (22 Product, 12 port, 4 testDatabase, 12 repository integration). `db:migrate` applied on dev DB; `d products` shows CHECKs + index. Parent found and fixed (TDD) an ownership hole in `save` upsert: now `setWhere owner_id` + immutable id/owner/createdAt, throws on foreign id. ~650 authored lines (290 tests), above the 400 heuristic due to integration plumbing.

## Next step

After the T3 PR is merged: T4 use cases.
