# gestorIA

Product catalog management for small businesses: a REST API to create, read,
update, and soft-delete products, each scoped to its seller (`ownerId`), with a
React seller dashboard planned. See [docs/design.md](docs/design.md) for the
full design and roadmap.

## Quick start

```bash
cp .env.example .env                    # Docker Compose infra; set a real POSTGRES_PASSWORD
cp apps/api/.env.example apps/api/.env  # API settings; keep DATABASE_URL in sync
docker compose up -d                    # starts PostgreSQL (pgvector image)
npm install                             # installs and links all workspaces
npm run db:migrate -w @gestoria/api     # creates the database schema
npm run dev:api                         # API on http://localhost:3000
```

Check the database is ready with `docker compose ps` (status `healthy`).

Prerequisites: Node.js 22 or later (npm included), Docker with Docker Compose.

## API endpoints and documentation

With the API running (`npm run dev:api`):

| Path | Purpose |
|------|---------|
| `GET /docs` | Swagger UI, generated from the Zod schemas |
| `GET /openapi.json` | The raw OpenAPI 3 document |
| `GET /health` | Liveness check, returns `{ "status": "ok" }` |

Errors use RFC 9457 Problem Details (`application/problem+json`).

## Workspaces

npm workspaces monorepo. Apps may depend on packages; packages never depend on
apps, and apps never import each other.

| Path | Package | Purpose |
|------|---------|---------|
| `apps/api` | `@gestoria/api` | Express REST API (backend) |
| `packages/contracts` | `@gestoria/contracts` | Shared HTTP request/response DTO types |

`apps/web` (`@gestoria/web`, React + Vite) is added when frontend work starts.

## Root scripts

Root scripts orchestrate; each workspace owns its own scripts.

| Script | Purpose |
|--------|---------|
| `npm run dev:api` | Run the API with reload on change |
| `npm test` | Run tests in every workspace (unit + integration; needs PostgreSQL) |
| `npm run test:unit` | Run only unit tests in every workspace (no database required) |
| `npm run typecheck` | Type-check every workspace |
| `npm run build` | Build every workspace that has a build step |

Target one workspace with `-w`, for example `npm run test:watch -w @gestoria/api`.

### Database scripts (`@gestoria/api`)

The API uses Drizzle ORM. Each feature owns its table schema
(`src/<feature>/infrastructure/*.schema.ts`); SQL migrations live in `apps/api/migrations/`.

| Script | Purpose |
|--------|---------|
| `npm run db:generate -w @gestoria/api` | Generate a SQL migration from schema changes (drizzle-kit) |
| `npm run db:migrate -w @gestoria/api` | Apply pending migrations to `DATABASE_URL` |

## Configuration

| File | Used by | Contents |
|------|---------|----------|
| `.env` | Docker Compose | `POSTGRES_*` infra variables |
| `apps/api/.env` | API | `PORT`, `DATABASE_URL`, `JWT_SECRET` (>= 32 chars, required) |
| `tsconfig.base.json` | All workspaces | Shared strict compiler options |

## API layout (`apps/api`)

Feature-first hexagonal architecture: each feature owns its layers.

```
apps/api/src/
  products/
    domain/          Product entity and business rules
    application/     Use cases
    infrastructure/  HTTP controllers, database adapters
  shared/            Cross-feature building blocks
  app.ts             Express app factory (createApp)
  server.ts          Entry point: validates env, wires adapters, listens
```

## Development workflow

This project follows TDD: write a failing test (RED), make it pass (GREEN),
then refactor. Tests live next to the code they cover as `*.test.ts`.

Integration tests (`*.int.test.ts`) run against real PostgreSQL, so start the
database first (`docker compose up -d`). They use a dedicated test database named
after `DATABASE_URL` with `_test` appended (for example `gestoria_test`); Vitest
creates and migrates it automatically, so development data is never touched.
Run only the unit tests, without PostgreSQL, with `npm run test:unit`.
