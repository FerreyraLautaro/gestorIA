# Feature: monorepo-migration

Locator: `odd/tasks/monorepo-migration.md` · Engram topic: `odd/monorepo-migration/tasks`
Branch: `refactor/monorepo` (stacked on `feat/phase1-scaffold`) · Design reference: `docs/design.md` §7

## Objective

Restructure the repository into an npm-workspaces monorepo as defined in the design:
`apps/api` (current backend), `packages/contracts` (shared HTTP DTOs), with
`apps/web` reserved for the frontend.

## Problem / Why

The backend currently occupies the repository root. Adding the React frontend
without a defined structure would mix configs and dependencies. The structure is
cheap to change now (small codebase) and expensive later.

## Scope

- Move backend to `apps/api` with `git mv` (history preserved).
- Root `package.json` (workspaces, orchestration scripts only) and `tsconfig.base.json`.
- `packages/contracts` with initial product/auth DTO types.
- Per-workspace `.env.example`; root `.env.example` only for Docker Compose infra.
- README updated to the new layout.

Out of scope: `apps/web` scaffold (created when frontend work starts), Product GREEN.

## Constraints

- Behavior unchanged: the Product test stays RED for the same reason.
- Dependency rule: apps → packages only; packages never import apps.
- No AI attribution in commits; Conventional Commits.

## Tasks

- [x] T1 — Workspace root + `tsconfig.base.json`; move backend to `apps/api`. Route: delegated (writer, multi-file).
- [x] T2 — `packages/contracts` with DTO types, typechecked. Route: delegated (same writer).
- [x] T3 — Env files split (root infra vs `apps/api`), README update. Route: delegated (same writer).
- [x] T4 — Verify + commit. Route: inline.

## Acceptance criteria

- `npm install` at root links workspaces.
- `npm run typecheck` at root: only the intentional TS2307 for `./Product.js` in `apps/api`.
- `npm test` at root: Product suite RED for the same reason (missing module).
- `docker compose config` valid; git shows moved files as renames.

## Delivery

Strategy: `ask-on-risk`. Forecast: ~200 authored lines (excl. lockfile).

## Progress / Evidence

- Pre-step: design commit on this branch (`docs: define monorepo structure and frontend stack`).
- T1–T2: backend moved with `git mv` (renames preserved); root workspaces + `tsconfig.base.json`; `packages/contracts` types-only DTOs. `npm run typecheck`: only TS2307 `./Product.js`; contracts clean.
- T3: env split — root `.env.example` infra only, `apps/api/.env.example` PORT + DATABASE_URL (edited by user: agent permissions deny `.env*` files). README rewritten.
- T4: `npm test` RED same reason (parent spot check); `docker compose ps` db healthy.

## Next step

Return to `feat/phase1-scaffold` work: GREEN for `Product.create` inside `apps/api`.

## Delivery evidence

- Commits: `8660d09` (design), `b432f10` (migration).
- Native review (RDD): high risk (auth DTOs), consent granted, 4 lenses (risk, resilience, readability, reliability), approved and acknowledged (lineage `review-4be03d2f87d21137`).
- Non-blocking follow-ups:
  - R3-env-file-not-loaded (WARNING) — `apps/api` scripts never load `apps/api/.env`; add `--env-file` (Node) or equivalent.
  - R2-price-unit-unspecified — document price unit/currency in contracts.
  - R2-update-dto-put-semantics — clarify PUT vs PATCH semantics for `UpdateProductRequest`.
  - R2-design-tree-lists-unbuilt-web — mark `apps/web` as planned in the design tree.
  - R3/R4 contracts-runtime-ts-export — contracts export TS source; safe while types-only, needs a build step if runtime values are added.
