#!/bin/bash
# Run E2E tests with Docker containers for Postgres and Redis.
#
# Usage:
#   ./tests/e2e/run-e2e.sh
#
# Prerequisites:
#   - Docker installed and running
#   - npm dependencies installed

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.e2e.yml"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "==================================="
echo "  OFFER-HUB E2E Test Suite"
echo "==================================="
echo ""

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running."
    echo "Start Docker Desktop and try again."
    exit 1
fi

# Start containers
echo "🐳 Starting Docker containers..."
docker compose -f "$COMPOSE_FILE" up -d --wait

# Set environment
export DATABASE_URL="postgresql://e2e_user:e2e_password@localhost:5433/offerhub_e2e"
export DIRECT_URL="postgresql://e2e_user:e2e_password@localhost:5433/offerhub_e2e"
export REDIS_URL="redis://localhost:6380"
export NODE_ENV="test"
export PORT="4001"
export PAYMENT_PROVIDER="crypto"
export WALLET_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export OFFERHUB_MASTER_KEY="e2e_master_key_for_testing_only"
export STELLAR_NETWORK="testnet"
export STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org"
export STELLAR_USDC_ASSET_CODE="USDC"
export STELLAR_USDC_ISSUER="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
export TRUSTLESS_API_KEY="e2e_test_trustless_key"
export TRUSTLESS_WEBHOOK_SECRET="e2e_test_webhook_secret"
export TRUSTLESS_API_URL="https://dev.api.trustlesswork.com"
export PUBLIC_BASE_URL="http://localhost:4001"

# Run migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
npx prisma generate --schema packages/database/prisma/schema.prisma 2>/dev/null

# Run tests
echo ""
echo "🧪 Running E2E tests..."
echo ""

EXIT_CODE=0
npx jest --config jest.e2e.config.js --forceExit --detectOpenHandles "$@" || EXIT_CODE=$?

# Cleanup
echo ""
echo "🧹 Stopping Docker containers..."
docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ All E2E tests passed!"
else
    echo ""
    echo "❌ Some E2E tests failed (exit code: $EXIT_CODE)"
fi

exit $EXIT_CODE
