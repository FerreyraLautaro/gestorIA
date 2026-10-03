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
npm run dev:api                         # API on http://localhost:3000
```

Check the database is ready with `docker compose ps` (status `healthy`).

Prerequisites: Node.js 22 or later (npm included), Docker with Docker Compose.

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
| `npm test` | Run tests in every workspace |
| `npm run typecheck` | Type-check every workspace |
| `npm run build` | Build every workspace that has a build step |

Target one workspace with `-w`, for example `npm run test:watch -w @gestoria/api`.

## Configuration

| File | Used by | Contents |
|------|---------|----------|
| `.env` | Docker Compose | `POSTGRES_*` infra variables |
| `apps/api/.env` | API | `PORT`, `DATABASE_URL` |
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
  server.ts          Entry point: reads PORT and listens
```

## Development workflow

This project follows TDD: write a failing test (RED), make it pass (GREEN),
then refactor. Tests live next to the code they cover as `*.test.ts`.
