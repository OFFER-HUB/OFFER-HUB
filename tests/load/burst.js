import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { ENDPOINTS, STANDARD_THRESHOLDS } from './config.js';

/**
 * Burst Load Test
 *
 * Sends 200 requests in rapid succession to verify rate limiting kicks in
 * correctly and the system remains stable under burst traffic.
 *
 * Run: k6 run tests/load/burst.js
 */

const rateLimitedCount = new Counter('rate_limited_total');
const successCount = new Counter('success_total');
const rateLimitedRate = new Rate('rate_limited');
const responseTime = new Trend('response_time');

export const options = {
    scenarios: {
        burst: {
            executor: 'shared-iterations',
            vus: 20,
            iterations: 200,
            maxDuration: '1m',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<1000'],   // Allow higher latency under burst
        http_req_failed: ['rate<0.01'],       // Only true failures (not 429)
        rate_limited: ['rate>0.3'],           // At least 30% should be rate limited (200 reqs, limit 100)
    },
};

export default function () {
    const res = http.get(ENDPOINTS.health);

    responseTime.add(res.timings.duration);

    const isRateLimited = res.status === 429;
    rateLimitedRate.add(isRateLimited);

    if (isRateLimited) {
        rateLimitedCount.add(1);

        check(res, {
            '429 has RATE_LIMITED code': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.error?.code === 'RATE_LIMITED';
                } catch {
                    return false;
                }
            },
            '429 has retryAfter': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.error?.details?.retryAfter > 0;
                } catch {
                    return false;
                }
            },
        });
    } else {
        successCount.add(1);

        check(res, {
            'status is 200': (r) => r.status === 200,
            'has rate limit remaining header': (r) =>
                r.headers['X-Ratelimit-Remaining'] !== undefined,
        });
    }

    check(res, {
        'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
        'no server errors': (r) => r.status < 500,
    });
}

export function handleSummary(data) {
    const totalRequests = data.metrics.http_reqs?.values?.count || 0;
    const rateLimited = data.metrics.rate_limited_total?.values?.count || 0;
    const success = data.metrics.success_total?.values?.count || 0;
    const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;

    const report = {
        test: 'Burst Load (200 requests rapid-fire)',
        timestamp: new Date().toISOString(),
        results: {
            totalRequests,
            successfulRequests: success,
            rateLimitedRequests: rateLimited,
            rateLimitedPct: ((rateLimited / totalRequests) * 100).toFixed(2) + '%',
            p95ResponseMs: p95.toFixed(2),
        },
        pass: rateLimited > 0 && p95 < 1000,
    };

    return {
        'tests/load/results/burst.json': JSON.stringify(report, null, 2),
        stdout: JSON.stringify(report, null, 2) + '\n',
    };
}
