# ticketing-service

A reference/portfolio backend project implementing production-grade backend
patterns end to end: authentication, rate limiting, caching, queues, retries,
webhooks, database transactions, logging, monitoring, and failure handling —
built around a real ticketing system domain (events, ticket inventory, orders,
payments, check-in).

## Status

Complete — all core patterns implemented and tested, plus a sharded-inventory
scaling extension for high-demand flash-sale scenarios.

- [x] Project setup (TypeScript, Express, Postgres, Redis, env validation, health check)
- [x] DB schema + migrations (events, ticket_types, orders, tickets, webhook_events, users)
- [x] Auth (JWT + roles)
- [x] Core reservation transaction logic
- [x] Payment + webhook handling (real M-Pesa Daraja sandbox integration)
- [x] Queues + workers (BullMQ, retries, idempotent ticket generation)
- [x] Rate limiting + caching
- [x] Logging + monitoring
- [x] Reconciliation job (automated, scheduled)
- [x] Tests (concurrency safety, webhook idempotency)
- [x] Inventory sharding for scale (flash-sale concurrency)

## Stack

- Node.js + TypeScript
- Express
- PostgreSQL (via `pg`, migrations via `node-pg-migrate`)
- Redis (via `ioredis`)
- BullMQ (background jobs)
- Pino (structured logging)
- M-Pesa Daraja API (payments)
- Docker Compose for local Postgres + Redis

## Local setup

```bash
cp .env.example .env
docker compose up -d      # starts Postgres + Redis
npm install
npm run migrate:up        # applies all DB migrations
npm run dev                # starts the API on :3000
npm run worker              # in a separate terminal — processes ticket generation jobs
```

Check it's alive:

```bash
curl http://localhost:3000/health
```

Run tests:

```bash
npm test
```

## Manual reconciliation

The worker runs reconciliation automatically every 60 seconds. To trigger it manually:

```bash
npm run reconcile
```

## Project layout

src/
config/ env, db pool, redis clients
middleware/ auth, rate limiting, request logging
routes/ express routers (auth, orders, payments, webhooks, events)
services/ business logic (inventory, payment/daraja, cache, reconciliation, auth)
queues/ BullMQ queue definitions
workers/ BullMQ worker process (also runs scheduled reconciliation)
db/ raw SQL schema reference
utils/ logger
migrations/ versioned migrations (node-pg-migrate)
tests/ vitest test suite

## Key design decisions

- **Overselling prevention**: `SELECT ... FOR UPDATE` row-locking in the reservation
  transaction, verified under real concurrency in `tests/reservation.test.ts`.
- **Webhook idempotency**: a unique constraint on `(provider, event_id)` in
  `webhook_events` makes duplicate payment provider callbacks safe no-ops.
- **Queue failures never roll back payments**: ticket generation is enqueued
  *after* the payment transaction commits — a Redis outage leaves the order
  correctly `paid`, and the reconciliation job catches and retries any order
  missing a ticket.
- **Cache correctness over hit rate**: event/availability caching uses a short
  TTL (30s) plus explicit invalidation on every inventory-changing write.
- **Inventory sharding for flash-sale scale**: ticket inventory is split across
  N `ticket_type_shards` rows per ticket type instead of one counter. A
  reservation locks and decrements exactly one randomly-chosen shard, so
  contention is spread across shards instead of serializing on a single hot
  row. A low-demand event uses 1 shard (behaviorally identical to a flat
  counter); a high-demand event uses many. Verified under 40 concurrent
  requests against 20 tickets across 10 shards in `tests/sharding.test.ts`.
  At true production scale, this pairs with a virtual waiting room (not
  implemented here) that admits buyers in controlled batches rather than
  letting all traffic hit the reservation endpoint at once.