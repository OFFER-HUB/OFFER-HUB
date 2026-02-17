# E2E Test Suite

End-to-end tests for OFFER-HUB Orchestrator. Tests run against a real NestJS app with Docker containers for PostgreSQL and Redis.

## Prerequisites

- **Docker** installed and running
- **Node.js 20+** with npm dependencies installed

## Running

```bash
# From project root
npm run test:e2e

# Or directly
./tests/e2e/run-e2e.sh
```

This will:
1. Start PostgreSQL (port 5433) and Redis (port 6380) in Docker
2. Run Prisma migrations on the test database
3. Boot the NestJS app in test mode
4. Execute all E2E test suites
5. Tear down Docker containers

## Test Suites

| Suite | Tests | What it covers |
|-------|-------|---------------|
| `health.e2e.ts` | 4 | Health endpoint, rate limit headers, auth rejection, API key creation |
| `users.e2e.ts` | 6 | User CRUD, duplicate rejection, validation, wallet auto-creation |
| `balance.e2e.ts` | 6 | Balance read, credit, reserve, insufficient funds |
| `orders.e2e.ts` | 8 | Order create, list, reserve flow, cancel flow, milestone orders |
| `disputes.e2e.ts` | 3 | Dispute opening, validation, invalid state rejection |
| `idempotency.e2e.ts` | 6 | Idempotency key caching, mismatch detection, rate limiting 429 |

## Environment

Tests use isolated infrastructure that doesn't affect development:

| Service | Port | Credentials |
|---------|------|-------------|
| PostgreSQL | 5433 | `e2e_user:e2e_password` / `offerhub_e2e` |
| Redis | 6380 | No password |
| API | 4001 | Master key: `e2e_master_key_for_testing_only` |

## Structure

```
tests/e2e/
├── README.md
├── docker-compose.e2e.yml    # Postgres + Redis containers
├── run-e2e.sh                # Runner script
├── global-setup.ts           # Jest global setup (Docker + migrations)
├── global-teardown.ts        # Jest global teardown (Docker cleanup)
├── helpers/
│   ├── index.ts              # Re-exports
│   ├── app.ts                # NestJS app creation + supertest agent
│   └── auth.ts               # API key management
├── health.e2e.ts             # Health & auth smoke tests
├── users.e2e.ts              # User creation + wallet
├── balance.e2e.ts            # Balance operations
├── orders.e2e.ts             # Order lifecycle
├── disputes.e2e.ts           # Dispute flows
└── idempotency.e2e.ts        # Idempotency + rate limiting
```

## Troubleshooting

### "Docker is not running"
Start Docker Desktop before running tests.

### "Port 5433 already in use"
Another test run may be active. Run `docker compose -f tests/e2e/docker-compose.e2e.yml down -v` to clean up.

### "Migration failed"
Check that PostgreSQL container is healthy: `docker ps | grep e2e-postgres`

### Tests timing out
Default timeout is 30 seconds. Some tests wait for async operations (wallet creation). Increase with `--testTimeout 60000`.
