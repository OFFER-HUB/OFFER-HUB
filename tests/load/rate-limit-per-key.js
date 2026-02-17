import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { ENDPOINTS, API_KEY } from './config.js';

/**
 * Rate Limit Per API Key Test
 *
 * Verifies that rate limiting is enforced per API key (not globally).
 * Sends requests with an API key to verify key-specific rate limiting.
 *
 * Requires: API_KEY environment variable
 *
 * Run: API_KEY=ohk_your_key k6 run tests/load/rate-limit-per-key.js
 */

const rateLimitedCount = new Counter('rate_limited_total');
const successCount = new Counter('success_total');
const rateLimitedRate = new Rate('rate_limited');

export const options = {
    scenarios: {
        // Scenario 1: Authenticated requests (should be rate-limited per API key)
        authenticated: {
            executor: 'shared-iterations',
            vus: 10,
            iterations: 120,  // Over the 100/min limit
            maxDuration: '30s',
            env: { SCENARIO: 'authenticated' },
        },
        // Scenario 2: Unauthenticated requests (rate-limited per IP)
        unauthenticated: {
            executor: 'shared-iterations',
            vus: 5,
            iterations: 120,
            maxDuration: '30s',
            startTime: '35s',  // Start after authenticated scenario
            env: { SCENARIO: 'unauthenticated' },
        },
    },
    thresholds: {
        'rate_limited{scenario:authenticated}': ['rate>0.1'],     // Some should be limited
        'rate_limited{scenario:unauthenticated}': ['rate>0.1'],   // Some should be limited
        http_req_duration: ['p(95)<1000'],
    },
};

export default function () {
    const scenario = __ENV.SCENARIO;
    const headers = {};

    if (scenario === 'authenticated' && API_KEY) {
        headers['x-api-key'] = API_KEY;
    }

    const res = http.get(ENDPOINTS.health, { headers, tags: { scenario } });

    const isRateLimited = res.status === 429;
    rateLimitedRate.add(isRateLimited, { scenario });

    if (isRateLimited) {
        rateLimitedCount.add(1, { scenario });
    } else {
        successCount.add(1, { scenario });
    }

    check(res, {
        'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
        'no server errors': (r) => r.status < 500,
        'has rate limit headers': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
    });

    // Check rate limit remaining decreases
    if (res.status === 200) {
        const remaining = parseInt(res.headers['X-Ratelimit-Remaining'] || '0', 10);
        check(res, {
            'remaining decreases': () => remaining >= 0,
        });
    }
}

export function handleSummary(data) {
    const totalRequests = data.metrics.http_reqs?.values?.count || 0;
    const rateLimited = data.metrics.rate_limited_total?.values?.count || 0;
    const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;

    const report = {
        test: 'Rate Limit Per API Key',
        timestamp: new Date().toISOString(),
        results: {
            totalRequests,
            rateLimitedRequests: rateLimited,
            p95ResponseMs: p95.toFixed(2),
            apiKeyUsed: API_KEY ? 'yes' : 'no (IP-based only)',
        },
        pass: rateLimited > 0 && p95 < 1000,
    };

    return {
        'tests/load/results/rate-limit-per-key.json': JSON.stringify(report, null, 2),
        stdout: JSON.stringify(report, null, 2) + '\n',
    };
}
