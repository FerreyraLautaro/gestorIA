# Feature: phase1-scaffold

Locator: `odd/tasks/phase1-scaffold.md` · Engram topic: `odd/phase1-scaffold/tasks`
Branch: `feat/phase1-scaffold` · Design reference: `docs/design.md`

## Objective

Bootstrap Phase 1 (MVP): project structure, local PostgreSQL via Docker Compose,
and the first failing test (TDD RED) for the Product domain.

## Problem / Why

The repository only holds the design document. Every later task (product CRUD,
auth, Swagger) needs a working TypeScript toolchain, a test runner, and a database.

## Scope

- Node.js + TypeScript (strict) + Express project skeleton, feature-first hexagonal layout.
- Vitest configured.
- Docker Compose with PostgreSQL (pgvector image) + healthcheck.
- `.env.example`, `.gitignore`, README with setup.
- First failing unit test for `Product` creation rules (RED only, no implementation).

Out of scope: Product implementation (GREEN), DB driver/migrations, endpoints, auth, Swagger.

## Constraints

- Artifacts in English. TDD: the test is written before any domain code.
- User asked for a single commit at the end of the phase (overrides per-task commits).
- No AI attribution in commits; Conventional Commits.

## Tasks

- [x] T1 — Project skeleton: package.json, tsconfig (strict), vitest config, folders, `.gitignore`, `.env.example`. Route: delegated (writer, 2+ files).
- [x] T2 — Docker Compose with PostgreSQL + healthcheck; verify container becomes healthy. Route: delegated (same writer).
- [x] T3 — First failing test for `Product.create` (RED observed). Route: delegated (same writer).
- [x] T4 — README setup docs + design doc layout update. Route: delegated (same writer).
- [x] T5 — Commit the phase. Route: inline (git state).

## Acceptance criteria

- `docker compose up -d` brings PostgreSQL to `healthy`.
- `npm test` runs and the Product test fails for the expected reason (RED: domain module not implemented).
- Typecheck errors are limited to the intentionally missing domain module.

## Delivery

Strategy: `ask-on-risk`. Forecast: ~150 authored lines (excl. lockfile) — single PR.

## Progress / Evidence

- T1: `npm install` OK (68 packages, 0 vulnerabilities). Deviation accepted: `tsconfig.build.json` excludes tests from build; `tsconfig.json` type-checks tests.
- T3: RED observed — `npm test`: `Cannot find module './Product.js'` (1 file failed); `npm run typecheck`: only TS2307 for `./Product.js`. Parent spot check re-ran `npm test`: same RED.
- T4: README rewritten; design.md section 7 updated to feature-first layout.
- T2: `docker compose up -d` → `db healthy` (pgvector/pgvector:pg17). Container left running for development.

## Next step

GREEN: implement `Product.create` in `src/products/domain/Product.ts` to pass the RED tests.

## Delivery evidence

- Commit `846b15d` — `chore: scaffold phase 1 project with failing Product test` (amended to add `.atl/` to `.gitignore`).
- Native review (RDD): assessed medium, consent granted, one lens (review-reliability), approved and acknowledged (lineage `review-c8ab5f456c9066ab`, authority burned).
- Non-blocking follow-ups from review:
  - R3-port-parse-unvalidated — `src/server.ts:4`: validate `PORT` (empty → 0, non-numeric → NaN).
  - R3-red-suite-committed — expected TDD RED; resolved by the GREEN step.
  - R3-untyped-throw-assertions — assert specific domain errors; cover NaN/Infinity price and zero price/stock.
