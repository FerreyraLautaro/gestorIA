# gestorIA — Design Document (DRAFT v0.1)

> Status: draft. Items marked **[TBD]** are open questions.

## 1. Context

Final project for a Master's in AI-assisted development. The goal is a web
application where a user can publish products and accept or decline
reservation requests, evolving in three phases.

## 2. Problem

Small sellers lack a simple way to:

- Control their stock.
- Review their sales / reservations.
- Respond to customers in a timely way.

## 3. Vision (3 phases)

| Phase | Name | Outcome |
|-------|------|---------|
| 1 | MVP — REST API | CRUD for products (create, update, delete, read). |
| 2 | Dynamic inventory + reservations | Stock changes with reservations; owner accepts/declines requests. Web UI. |
| 3 | AI agent + RAG | Customers query and reserve through a conversational agent grounded in the catalog via RAG. |

This document details Phase 1 and sketches Phases 2–3 only to avoid
design decisions that block them.

## 4. Phase 1 — MVP scope

### In scope

- REST API for products: create, read (list/detail), update, delete.
- Input validation and consistent error responses.
- Persistence in a relational database.
- OpenAPI documentation.
- Automated tests.
- Seller authentication; products scoped per seller (`ownerId`).

### Out of scope (Phase 1)

- Reservations, sales, customers.
- Web UI.
- AI agent and RAG.

## 5. Domain model (initial)

**Account** (one per business; its `id` is the `ownerId` on products)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| email | string | unique, login identifier |
| passwordHash | string | never the plain password |
| businessName | string | |
| createdAt / updatedAt | timestamp | |

**Product**

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| ownerId | UUID | seller that owns the product; isolation key (see below) |
| name | string | required |
| description | string | optional; later feeds RAG |
| price | decimal | >= 0 |
| stock | integer | >= 0 |
| status | enum | `active` / `inactive` |
| createdAt / updatedAt | timestamp | |

**Multi-seller isolation:** every query on products is scoped by `ownerId`;
a seller can never read or modify another seller's products.
Decision: one account per business. Target users are small businesses
(up to ~2 people) who share the same account, so `ownerId` is the tenant key.
A separate `Store` entity and per-staff users are explicitly out of scope;
revisit only if per-person audit or permissions become a requirement.

**Delete policy:** soft delete. `DELETE /products/{id}` sets `status = inactive`;
rows are never physically removed, because Phase 2 reservations will
reference products. Listings return only `active` products by default.

## 6. API (initial)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Return access token |
| POST | `/products` | Create product |
| GET | `/products` | List (pagination, filter by status) |
| GET | `/products/{id}` | Product detail |
| PUT/PATCH | `/products/{id}` | Update product |
| DELETE | `/products/{id}` | Soft delete (set `status = inactive`) |

All `/products` endpoints require a valid token; `ownerId` is taken from the
token, never from the request body.

### Authentication

Self-managed email + password with JWT:

- Passwords stored only as a slow, salted hash (e.g. bcrypt/argon2).
- Login returns a signed, short-lived JWT carrying the account `id`.
- An auth middleware validates the token and injects `ownerId` into the request.
- **[TBD]** Refresh tokens and password recovery (likely post-MVP).

## 7. Architecture

### Repository structure (monorepo)

One repository managed with **npm workspaces** (no extra monorepo tooling until
build times justify it).

```
gestoria/
  apps/
    api/              @gestoria/api — Express REST API (backend)
    web/              @gestoria/web — React + Vite SPA (seller dashboard)
  packages/
    contracts/        @gestoria/contracts — shared HTTP contract (request/response DTOs)
  docs/               Design and project documentation
  odd/                Task tracking
  docker-compose.yml  Local infrastructure (PostgreSQL)
  tsconfig.base.json  Shared compiler options
  package.json        Workspace root: orchestration scripts only, no runtime code
```

Rules:

- **Dependency direction:** `apps/*` may depend on `packages/*`; `packages/*` never
  depend on `apps/*`; `api` and `web` never import each other.
- **Contracts, not domain:** `packages/contracts` holds only the HTTP shapes the
  API exposes (DTOs). Domain entities and business rules stay inside `apps/api`.
- **Each workspace is self-contained:** its own `package.json`, `tsconfig.json`
  (extending `tsconfig.base.json`), test config, and `.env.example`.
- **Root scripts orchestrate:** `npm run test|typecheck|build` run across all
  workspaces; `npm run dev -w @gestoria/api` targets one.
- **Infrastructure is shared:** `docker-compose.yml` stays at the root.

### Backend layout (`apps/api`)

Hexagonal (ports and adapters), so later phases plug in without rewriting the core.
Code is organized feature-first: each feature owns its hexagonal layers.

```
src/
  products/
    domain/          Product entity, business rules
    application/     Use cases (CreateProduct, UpdateProduct, ...)
    infrastructure/  REST controllers, DB repository adapters
  shared/            Cross-feature building blocks
```

- The domain has no framework dependencies.
- Persistence sits behind a repository port.
- Phase 3 adds the agent/RAG as another adapter over the same use cases.

## 8. Tech stack

| Concern | Choice |
|---------|--------|
| Runtime | Node.js (LTS) |
| Language | TypeScript (strict mode) |
| HTTP framework | Express |
| Database | PostgreSQL (pgvector-enabled image), run locally via Docker Compose |
| Frontend | React + Vite + TypeScript (SPA, private seller dashboard) |
| Repository | Monorepo with npm workspaces (`apps/api`, `apps/web`, `packages/contracts`) |
| AI agent framework (Phase 3) | Genkit (Node.js/TypeScript SDK) |
| Test tooling | Vitest (unit + integration), Supertest (HTTP endpoints) |
| Deployment target | Docker: Docker Compose locally; the same image deploys to any Docker-capable host |

## 9. Non-functional requirements

- **TDD by default:** write a failing test first (RED), implement (GREEN), then
  refactor. Unit tests for domain and use cases; integration tests for endpoints
  against a real PostgreSQL instance.
- **API documentation:** an OpenAPI 3 spec, served with Swagger UI, updated in
  the same change as every endpoint.
- **Project documentation:** README (setup and usage) and this design document
  kept current as decisions are made.
- Reproducible setup (Docker Compose recommended).
- Configuration via environment variables.

## 10. Roadmap

1. Phase 1 — Product CRUD API.
2. Phase 2 — Reservations workflow + web UI.
3. Phase 3 — Agent + RAG.

## 11. Open questions

1. ~~Tech stack (language/framework)~~ — resolved: Node.js + Express + TypeScript.
2. ~~Authentication and multi-user scope~~ — resolved: multi-seller, one shared
   account per business, `ownerId` as tenant key.
3. ~~Delete policy~~ — resolved: soft delete (`status = inactive`).
4. ~~Database engine~~ — resolved: PostgreSQL in Docker; `pgvector` reserved
   for Phase 3 embeddings, so no separate vector store is needed.
5. ~~Deployment target~~ — resolved: Docker. The app ships as a container image
   configured only via environment variables, so it is host-agnostic. If a
   managed PostgreSQL is used in production, it must support `pgvector`.
6. Phase 3: LLM provider. Framework resolved: Genkit; vector store: pgvector.
   Genkit is added as a dependency when Phase 3 starts, not in the MVP.
