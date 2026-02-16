# Load Testing Suite

k6-based load tests for OFFER-HUB Orchestrator. Verifies rate limiting, performance under load, database connection pooling, and background job processing.

## Prerequisites

### Install k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker pull grafana/k6
```

### Start the Server

```bash
# From project root
npm run dev

# Verify it's running
curl http://localhost:4000/api/v1/health
```

## Running Tests

### Run All Tests

```bash
./tests/load/run-all.sh

# With custom target
BASE_URL=http://staging.example.com API_KEY=ohk_xxx ./tests/load/run-all.sh
```

### Run Individual Tests

```bash
# Sustained load (100 req/min for 2 minutes)
k6 run tests/load/sustained.js

# Burst load (200 requests rapid-fire)
k6 run tests/load/burst.js

# Rate limit per API key
API_KEY=ohk_your_key k6 run tests/load/rate-limit-per-key.js

# Database connection pooling
k6 run tests/load/database-pool.js

# BullMQ job processing (requires API key)
API_KEY=ohk_your_key k6 run tests/load/job-processing.js
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:4000` | Target API URL |
| `API_KEY` | — | API key for authenticated endpoints |

## Test Descriptions

### 1. Sustained Load (`sustained.js`)

Sends 100 requests per minute for 2 minutes. Verifies:
- System handles target load without errors
- Less than 1% of requests are rate-limited
- p95 response time under 500ms

### 2. Burst Load (`burst.js`)

Fires 200 requests as fast as possible. Verifies:
- Rate limiting activates (at least 30% of requests should get 429)
- 429 responses include proper `RATE_LIMITED` error format
- No 5xx server errors under burst
- p95 response time under 1000ms

### 3. Rate Limit Per Key (`rate-limit-per-key.js`)

Tests rate limiting isolation between authenticated and unauthenticated requests:
- Authenticated: Uses `x-api-key` header → rate limited per key
- Unauthenticated: No key → rate limited per IP
- Verifies `X-RateLimit-*` headers are present

### 4. Database Pool (`database-pool.js`)

Ramps up to 20 concurrent users hitting `/health/detailed` (which queries the database). Verifies:
- Connection pool doesn't exhaust
- Less than 5% errors
- p95 response time under 2000ms

### 5. Job Processing (`job-processing.js`)

Creates users at 10/second rate to exercise BullMQ background jobs (wallet creation, events). Verifies:
- User creation succeeds under load
- p95 create time under 3000ms
- Less than 20% failure rate

## Results

Test results are saved to `tests/load/results/` as JSON files:

```
tests/load/results/
├── sustained.json
├── burst.json
├── rate-limit-per-key.json
├── database-pool.json
└── job-processing.json
```

Each result file contains:
```json
{
  "test": "Sustained Load (100 req/min)",
  "timestamp": "2026-02-16T...",
  "results": {
    "totalRequests": 200,
    "rateLimitedPct": "0.00%",
    "p95ResponseMs": "45.23",
    "failRate": "0.00%"
  },
  "pass": true
}
```

## Performance Targets

| Metric | Target | Measured By |
|--------|--------|-------------|
| p95 Response Time | < 500ms | sustained, burst |
| p99 Response Time | < 1000ms | sustained |
| Rate Limit Accuracy | 429 at request 101+ | burst |
| Error Rate (sustained) | < 1% | sustained |
| Error Rate (burst) | < 1% (excluding 429) | burst |
| DB Pool Exhaustion | 0 occurrences | database-pool |

## Test Structure

```
tests/load/
├── README.md              # This file
├── config.js              # Shared configuration
├── run-all.sh             # Run all tests sequentially
├── sustained.js           # 100 req/min sustained load
├── burst.js               # 200 requests burst
├── rate-limit-per-key.js  # Per-key rate limiting
├── database-pool.js       # DB connection pooling
├── job-processing.js      # BullMQ under load
└── results/               # JSON result files (gitignored)
```
