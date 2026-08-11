# ticketing-service

A reference/portfolio backend project implementing production-grade backend
patterns end to end: authentication, rate limiting, caching, queues, retries,
webhooks, database transactions, logging, monitoring, and failure handling —
built around a real ticketing system domain (events, ticket inventory, orders,
payments, check-in).

## Status

🚧 Work in progress, built step by step.

- [x] Project setup (TypeScript, Express, Postgres, Redis, env validation, health check)
- [x] DB schema + migrations (events, ticket_types, orders, tickets, webhook_events)
- [ ] Auth (JWT + roles)
- [ ] Core reservation transaction logic
- [ ] Payment + webhook handling
- [ ] Queues + workers
- [ ] Rate limiting + caching
- [ ] Logging + monitoring
- [ ] Reconciliation job
- [ ] Tests

## Stack

- Node.js + TypeScript
- Express
- PostgreSQL (via `pg`, migrations via `node-pg-migrate`)
- Redis (via `ioredis`)
- Docker Compose for local Postgres + Redis

## Local setup

\`\`\`bash
cp .env.example .env
docker compose up -d      # starts Postgres + Redis
npm install
npm run migrate:up        # applies all DB migrations
npm run dev                # starts the API on :3000
\`\`\`

Check it's alive:

\`\`\`bash
curl http://localhost:3000/health
\`\`\`

## Project layout

\`\`\`
src/
  config/      env, db pool, redis clients
  ...
migrations/    versioned SQL/JS migrations (node-pg-migrate)
\`\`\`