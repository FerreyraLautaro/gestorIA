# gestorIA — Design Document (DRAFT v0.2)

> Status: draft. Items marked **[TBD]** are open questions.
> v0.2 adopts the business design of the "SaaS modular — v1 scope" spec
> (customers, orders with a status workflow, stock movements, event log, module
> rules) on top of the stack already built in Phase 1.

## 1. Context

Final project for a Master's in AI-assisted development. The goal is a
multi-company management application for small businesses: inventory,
customers and orders, later assisted by an AI agent.

The first real user is a family business that sells fresh pasta. The product
must work end to end for it, while staying generic: any small business can
register its own company, and new modules (promotions, suppliers, ...) can be
added without rewriting existing ones.

## 2. Problem

Small businesses lack a simple way to:

- Control their stock and know why it changed.
- Register customers and take their orders.
- Track each order from request to delivery.
- Ask questions about their own data without building reports.

## 3. Vision (phases)

| Phase | Name | Outcome |
|-------|------|---------|
| 1 | MVP — REST API | Auth (JWT + refresh rotation) and product CRUD isolated per company. **Done.** |
| 1.5 | Alignment | Product `sku`, `minStock` and `metadata`; stock movements; event bus and event log. |
| 2 | Customers + orders | Customers; orders with lines and a status workflow that reserves and returns stock. |
| 3 | Web UI | Seller dashboard: login, inventory, customers, orders. |
| 4 | AI agent | Read-only Genkit agent over the module tools and the event log; actions later, behind human approval. |

Each phase ends with something usable and tested; the next one starts only
when the previous one works.

## 4. Scope

### Phase 1 (done)

- REST API for products: create, read (list/detail), update, soft delete.
- Self-managed authentication; every product scoped by company (`ownerId`).
- Zod validation, RFC 9457 errors, OpenAPI docs, automated tests.

### Out of scope until a later phase

- Roles and fine-grained permissions, several users per company.
- Promotions, suppliers, payments, invoicing, advanced reports.
- WhatsApp or email notifications.

The tables are designed so that several users per company can be added later
without migrating existing data.

## 5. Domain model

**Account** (one per company; its `id` is the `ownerId` of every other record)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| email | string | unique, login identifier |
| passwordHash | string | never the plain password |
| businessName | string | company name |
| createdAt / updatedAt | timestamp | |

Decision: one account per company. Target users are small businesses
(up to ~2 people) who share the same account, so `ownerId` is the tenant key.
Splitting it into `companies` + `company_users` is deferred until several users
per company or roles are required.

**Product** (inventory)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| ownerId | UUID | tenant key |
| sku | string | unique per company *(Phase 1.5)* |
| name | string | required |
| description | string | optional; later feeds the agent |
| price | integer | >= 0, whole Argentine pesos (ARS); single currency |
| stock | integer | >= 0, never negative |
| minStock | integer | optional; going below it emits `stock.low` *(Phase 1.5)* |
| metadata | JSON | free attributes (e.g. pasta type, weight, shelf life) *(Phase 1.5)* |
| status | enum | `active` / `inactive` (soft delete) |
| createdAt / updatedAt | timestamp | |

Decision: prices stay **integer ARS** instead of `numeric(12,2)`. Whole pesos
avoid floating-point errors and match how the first customer prices products.
Revisit if a customer needs cents or another currency.

**StockMovement** (inventory, Phase 1.5): `productId`, `quantity` (positive or
negative), `reason` (`manual_adjustment`, `order_approved`, `order_cancelled`),
`referenceId` (e.g. the order), `actorType`, `actorId`, `createdAt`.
Stock only changes together with a movement, in the same transaction.

**Customer** (customers, Phase 2)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| ownerId | UUID | tenant key |
| name | string | required |
| phone | string | international format (e.g. `+5493511234567`); unique per company |
| metadata | JSON | future data without migrations |
| createdAt / updatedAt | timestamp | |

**Order** (orders, Phase 2)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| ownerId | UUID | tenant key |
| number | integer | sequential per company: 1, 2, 3 |
| customerId | UUID | read through the customers module |
| status | enum | `pending`, `approved`, `rejected`, `delivered` |
| total | integer | ARS; sum of the lines at creation |
| notes | string | optional |
| rejectionReason | string | required when rejecting or cancelling |
| createdAt / updatedAt | timestamp | |

**OrderItem**: `orderId`, `productId`, `productName`, `quantity`, `unitPrice`,
`subtotal`. Name and price are copied at creation, so editing a product never
changes an existing order.

**OrderStatusHistory**: `orderId`, `fromStatus`, `toStatus`, `actorType`
(`user` or `agent`), `actorId`, `comment`, `createdAt`.

**Event** (shared, Phase 1.5): `id`, `ownerId`, `type` (e.g. `order.approved`),
`actorType` (`user`, `agent`, `system`), `actorId`, `payload` (JSON),
`createdAt`. Append-only: rows are never updated or deleted.

**Multi-company isolation:** every query is scoped by `ownerId`; a company can
never read or modify another company's data. Another company's record answers
`404`, never `403`.

**Delete policy:** soft delete. Products are never physically removed, because
orders reference them.

## 6. Business rules: orders and stock

Stock is reserved when an order is **approved**, not when it is delivered, so
the business never promises goods that are already committed.

| Transition | From → To | Stock |
|------------|-----------|-------|
| `createOrder` | — → `pending` | untouched; at least one line, quantities > 0 |
| `approveOrder` | `pending` → `approved` | checks every line and subtracts it in one transaction (one `order_approved` movement per line); if one line lacks stock, nothing is approved |
| `rejectOrder` | `pending` → `rejected` | untouched; reason required |
| `cancelOrder` | `approved` → `rejected` | returned in one transaction (one `order_cancelled` movement per line); reason required |
| `deliverOrder` | `approved` → `delivered` | untouched (already subtracted) |

- `rejected` and `delivered` are final states.
- Order lines can be edited only while the order is `pending`.
- Every transition goes through a single internal `changeStatus()` that checks
  an `ALLOWED_TRANSITIONS` constant, writes the status history and emits the
  event. Any other transition is rejected.

## 7. API

### Current (Phase 1)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Return access token (+ refresh token cookie) |
| POST | `/auth/refresh` | Rotate refresh token, return a new access token |
| POST | `/auth/logout` | Revoke the current refresh token |
| POST | `/products` | Create product (always created `active`) |
| GET | `/products` | List (pagination, filter by status) |
| GET | `/products/{id}` | Product detail |
| PATCH | `/products/{id}` | Partial update (only the fields sent change) |
| DELETE | `/products/{id}` | Soft delete (set `status = inactive`) |

All `/products` endpoints require a valid token; `ownerId` is taken from the
token, never from the request body (a body `ownerId` is rejected). `PUT` is not supported.
A malformed `{id}` answers `400`.
`status` cannot be sent on create; it changes only through `PATCH` or `DELETE`.

### Planned

- Phase 1.5: `POST /products/{id}/stock-adjustments`, `GET /products/{id}/stock-movements`.
- Phase 2: `/customers` (CRUD + search by name or phone) and `/orders`
  (create, list, detail, edit lines while pending, and one action per transition:
  `approve`, `reject`, `cancel`, `deliver`).

### Pagination

`GET /<collection>?page=<n>&pageSize=<5|10|20>`

- `pageSize` accepts only `5`, `10` or `20` (default `10`); any other value is a validation error.
- `page` starts at `1` (default `1`).
- Responses include `items` plus `pagination` (`page`, `pageSize`, `total`, `totalPages`).

### Validation and API documentation

- Request input is validated with **Zod** schemas at the HTTP boundary.
- The OpenAPI 3 spec is **generated from the same Zod schemas** (code-first) and
  served with Swagger UI. Every endpoint is documented in the same change that
  adds it: request, responses, error cases, and auth requirements.

### Error handling

Errors follow one format across the API: **RFC 9457 Problem Details**
(`application/problem+json` with `type`, `title`, `status`, `detail`, and
field-level `errors` for validation failures).

- **Domain errors** (e.g. `ValidationError`, `NotFoundError`) are plain classes
  in `src/shared/domain/errors`, free of HTTP concepts.
- A single **Express error middleware** in `src/shared/infrastructure/http`
  maps domain and Zod errors to HTTP status codes and Problem Details.
- Unknown errors return a generic `500` without leaking internals; details are logged.

### Authentication

Self-managed email + password with JWT:

- Passwords stored only as a **bcrypt** hash (salted, slow by design).
- Login returns a signed JWT carrying the account `id`, valid for **15 minutes**.
- An auth middleware validates the token and injects `ownerId` into the request.
- **Refresh tokens:** login also issues a refresh token valid for **7 days** (sliding).
  - Opaque random value; only its hash is stored (`refresh_tokens` table, linked to the account).
  - **Rotation:** each use issues a new refresh token and revokes the previous one;
    reuse of a revoked token revokes the whole token family (theft detection).
  - Sent to the browser as an `httpOnly`, `Secure`, `SameSite=Strict` cookie; the
    access token is kept in memory by the SPA, never in `localStorage`.
- **[TBD]** Password recovery (post-MVP).

## 8. Architecture

### Repository structure (monorepo)

One repository managed with **npm workspaces** (no extra monorepo tooling until
build times justify it).

```
gestoria/
  apps/
    api/              @gestoria/api — Express REST API (backend)
    web/              @gestoria/web — React + Vite SPA (seller dashboard; Phase 3)
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

Hexagonal (ports and adapters), organized feature-first: each module owns its
layers, so later phases plug in without rewriting the core.

```
src/
  accounts/          Auth: accounts, passwords, access and refresh tokens
  products/          Inventory (stock movements join in Phase 1.5)
  customers/         Phase 2
  orders/            Phase 2
    domain/          Entities, business rules, repository ports
    application/     Use cases (CreateOrder, ApproveOrder, ...)
    infrastructure/  HTTP routers, DB repository adapters
    index.ts         Public entry point of the module
  shared/            Cross-module building blocks: errors, config, db, http, events
```

### Module rules

These rules let a new module (promotions, suppliers, ...) be added without
touching the existing ones.

1. **One module, one folder** with the same internal layout.
2. **Only import through `index.ts`.** Another module may call `inventory.getProduct()`,
   never import its internal files.
3. **No reading foreign tables.** Orders asks the inventory module for a product;
   it never queries the `products` table. Only `shared` is usable by everyone.
4. **Business rules live in use cases.** HTTP routers, the future UI and the agent
   call the same use cases; no rule is written in an adapter.
5. **Every use case receives a context** with `ownerId` and `actor`
   (`user` | `agent` | `system`, plus its id), so tenant filtering and audit
   cannot be forgotten.
6. **Inputs are validated with Zod**, and those schemas are reused as agent tool
   definitions in Phase 4.
7. **Important changes emit events** (e.g. `order.approved`); other modules and the
   agent react without the emitter knowing them.
8. **Every event is logged first.** The bus stores the event in the append-only
   `events` table, then notifies subscribers. It is the memory the agent reads and
   allows replaying old events when a new subscriber appears.
9. **Each module declares a manifest:** id, events it emits and tools it offers
   to the agent.

### Events

In-process bus in `shared` for now; it can be replaced by an external queue
without changing the modules.

| Event | Emitted by | Payload |
|-------|------------|---------|
| `product.created` / `product.updated` | Inventory | productId |
| `stock.low` | Inventory | productId, stock, minStock |
| `customer.created` | Customers | customerId |
| `order.created` | Orders | orderId, customerId, total |
| `order.approved` / `order.rejected` / `order.delivered` | Orders | orderId, fromStatus, reason if any |

### Agent (Phase 4)

Each module declares which use cases an agent may call:

- **Read:** `listProducts`, `getProduct`, `findCustomer`, `listOrders`, `getOrder`,
  `getSalesSummary(period)`, `listEvents(filters)`.
- **Action:** `approveOrder`, `rejectOrder`, `cancelOrder`, `adjustStock`. Disabled in the
  first agent, later behind human approval.

The first agent is a read-only Genkit flow that answers questions such as
"which products are low on stock and have pending orders?". If it is wrong it
breaks nothing. Every change it makes later is recorded with `actorType = agent`.

## 9. Tech stack

| Concern | Choice |
|---------|--------|
| Runtime | Node.js (LTS) |
| Language | TypeScript (strict mode) |
| HTTP framework | Express |
| Database | PostgreSQL (pgvector-enabled image), run locally via Docker Compose |
| Frontend | React + Vite + TypeScript (SPA, private seller dashboard) |
| Repository | Monorepo with npm workspaces (`apps/api`, `apps/web`, `packages/contracts`) |
| AI agent framework (Phase 4) | Genkit (Node.js/TypeScript SDK) |
| Data access | Drizzle ORM (SQL-like query builder) + Drizzle Kit migrations |
| Validation | Zod |
| API docs | OpenAPI 3 generated from Zod schemas, served with Swagger UI |
| Password hashing | bcrypt (bcryptjs) |
| Tokens | JWT (jose, HS256) + opaque refresh tokens |
| Test tooling | Vitest (unit + integration), Supertest (HTTP endpoints) |
| Deployment target | Docker: Docker Compose locally; the same image deploys to any Docker-capable host |

## 10. Non-functional requirements

- **TDD by default:** write a failing test first (RED), implement (GREEN), then
  refactor. Unit tests for domain and use cases; integration tests for endpoints
  against a real PostgreSQL instance. Every order transition and stock rule has tests.
- **API documentation:** an OpenAPI 3 spec, served with Swagger UI, updated in
  the same change as every endpoint.
- **Project documentation:** README (setup and usage) and this design document
  kept current as decisions are made; updated at the end of every phase.
- Reproducible setup (Docker Compose recommended).
- Configuration via environment variables.

## 11. Roadmap

1. Phase 1 — Auth + product CRUD API. **Done.**
2. Phase 1.5 — Product `sku`, `minStock`, `metadata`; stock movements; event bus and log.
3. Phase 2 — Customers and orders (status workflow, stock reservation, history).
4. Phase 3 — Web UI (login, inventory, customers, orders).
5. Phase 4 — Read-only AI agent; then actions behind human approval.

## 12. Open questions

1. ~~Tech stack (language/framework)~~ — resolved: Node.js + Express + TypeScript.
2. ~~Authentication and multi-user scope~~ — resolved: multi-company, one shared
   account per company, `ownerId` as tenant key.
3. ~~Delete policy~~ — resolved: soft delete (`status = inactive`).
4. ~~Database engine~~ — resolved: PostgreSQL in Docker; `pgvector` reserved
   for the agent, so no separate vector store is needed.
5. ~~Deployment target~~ — resolved: Docker. The app ships as a container image
   configured only via environment variables, so it is host-agnostic. If a
   managed PostgreSQL is used in production, it must support `pgvector`.
6. ~~Reservations vs orders~~ — resolved: the Phase 2 workflow is **orders** with
   the status rules of section 6.
7. Phase 4: LLM provider (Gemini free tier to start; use fictitious data while on it).
   Whether RAG over product descriptions is needed is decided then.
8. **[TBD]** Language of code comments and docs: the repository is in English;
   the v1 spec asked for Spanish comments, docs and UI texts. UI texts will be
   Spanish (end users); comments and docs stay English unless decided otherwise.
