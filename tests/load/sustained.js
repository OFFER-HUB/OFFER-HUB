import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { ENDPOINTS, STANDARD_THRESHOLDS } from './config.js';

/**
 * Sustained Load Test
 *
 * Verifies the system handles 100 req/min sustained load without errors.
 * Gradually ramps up to target rate and holds for 2 minutes.
 *
 * Run: k6 run tests/load/sustained.js
 */

const rateLimitedRate = new Rate('rate_limited');
const responseTime = new Trend('response_time');

export const options = {
    scenarios: {
        sustained_load: {
            executor: 'constant-arrival-rate',
            rate: 100,            // 100 requests
            timeUnit: '1m',       // per minute (~1.67 req/s)
            duration: '2m',       // sustain for 2 minutes
            preAllocatedVUs: 10,
            maxVUs: 20,
        },
    },
    thresholds: {
        ...STANDARD_THRESHOLDS,
        rate_limited: ['rate<0.01'],  // Less than 1% should be rate limited
    },
};

export default function () {
    const res = http.get(ENDPOINTS.health);

    responseTime.add(res.timings.duration);

    const isRateLimited = res.status === 429;
    rateLimitedRate.add(isRateLimited);

    check(res, {
        'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
        'response time < 500ms': (r) => r.timings.duration < 500,
        'has rate limit headers': (r) => r.headers['X-Ratelimit-Limit'] !== undefined,
    });

    if (!isRateLimited) {
        check(res, {
            'health returns healthy': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.status === 'healthy' || body.data?.status === 'healthy';
                } catch {
                    return false;
                }
            },
        });
    }
}

export function handleSummary(data) {
    const totalRequests = data.metrics.http_reqs?.values?.count || 0;
    const rateLimited = data.metrics.rate_limited?.values?.rate || 0;
    const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
    const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
    const failRate = data.metrics.http_req_failed?.values?.rate || 0;

    const report = {
        test: 'Sustained Load (100 req/min)',
        timestamp: new Date().toISOString(),
        results: {
            totalRequests,
            rateLimitedPct: (rateLimited * 100).toFixed(2) + '%',
            p95ResponseMs: p95.toFixed(2),
            p99ResponseMs: p99.toFixed(2),
            failRate: (failRate * 100).toFixed(2) + '%',
        },
        pass: p95 < 500 && rateLimited < 0.01,
    };

    return {
        'tests/load/results/sustained.json': JSON.stringify(report, null, 2),
        stdout: JSON.stringify(report, null, 2) + '\n',
    };
}
