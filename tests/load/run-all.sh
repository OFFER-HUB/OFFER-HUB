#!/bin/bash
# Run all load tests sequentially.
#
# Prerequisites:
#   - k6 installed: brew install k6 (macOS) or https://k6.io/docs/getting-started/installation
#   - API server running on BASE_URL (default: http://localhost:4000)
#   - Redis running
#
# Usage:
#   ./tests/load/run-all.sh
#   BASE_URL=http://staging.example.com API_KEY=ohk_xxx ./tests/load/run-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"

mkdir -p "$RESULTS_DIR"

echo "==================================="
echo "  OFFER-HUB Load Test Suite"
echo "==================================="
echo ""
echo "Target: ${BASE_URL:-http://localhost:4000}"
echo "API Key: ${API_KEY:+configured}"
echo ""

# Check k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "Error: k6 is not installed."
    echo "Install with: brew install k6"
    echo "Or visit: https://k6.io/docs/getting-started/installation"
    exit 1
fi

# Check server is reachable
HEALTH_URL="${BASE_URL:-http://localhost:4000}/api/v1/health"
echo "Checking server health..."
if ! curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then
    echo "Error: Server is not reachable at $HEALTH_URL"
    echo "Start the server first: npm run dev"
    exit 1
fi
echo "Server is healthy."
echo ""

PASS_COUNT=0
FAIL_COUNT=0
TESTS=("sustained" "burst" "rate-limit-per-key" "database-pool")

# Run each test
for test in "${TESTS[@]}"; do
    echo "-----------------------------------"
    echo "Running: $test"
    echo "-----------------------------------"

    if k6 run "$SCRIPT_DIR/$test.js" 2>&1; then
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "FAILED: $test"
    fi
    echo ""

    # Wait between tests for rate limit windows to reset
    echo "Waiting 65s for rate limit window reset..."
    sleep 65
done

# Job processing test (requires API_KEY)
if [ -n "$API_KEY" ]; then
    echo "-----------------------------------"
    echo "Running: job-processing"
    echo "-----------------------------------"

    if k6 run "$SCRIPT_DIR/job-processing.js" 2>&1; then
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "FAILED: job-processing"
    fi
    echo ""
else
    echo "Skipping job-processing test (no API_KEY provided)"
fi

# Summary
echo "==================================="
echo "  Results"
echo "==================================="
echo "  Passed: $PASS_COUNT"
echo "  Failed: $FAIL_COUNT"
echo "  Results: $RESULTS_DIR/"
echo "==================================="

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
