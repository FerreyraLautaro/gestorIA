# gestorIA

REST API that lets small businesses manage their product catalog: create, read,
update, and soft-delete products, each scoped to its seller (`ownerId`).
Phase 1 of a three-phase project; see [docs/design.md](docs/design.md) for the
full design and roadmap.

## Prerequisites

- Node.js 22 or later (npm included)
- Docker with Docker Compose

## Quick start

```bash
cp .env.example .env      # then set a real POSTGRES_PASSWORD
docker compose up -d      # starts PostgreSQL (pgvector image)
npm install
npm run dev               # API on http://localhost:3000
```

Check the database is ready with `docker compose ps` (status `healthy`).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Run the API with reload on change (tsx) |
| `npm run build` | Compile TypeScript to `dist/` (tests excluded) |
| `npm start` | Run the compiled API |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check all sources, tests included |

## Project layout

Feature-first hexagonal architecture: each feature owns its layers.

```
src/
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
