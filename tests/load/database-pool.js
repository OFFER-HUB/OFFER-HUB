import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { ENDPOINTS, authHeaders, STANDARD_THRESHOLDS } from './config.js';

/**
 * Database Connection Pooling Test
 *
 * Exercises endpoints that hit the database (health/detailed checks DB)
 * under concurrent load to verify connection pool doesn't exhaust.
 *
 * Run: k6 run tests/load/database-pool.js
 */

const errorRate = new Rate('errors');
const dbResponseTime = new Trend('db_response_time');

export const options = {
    scenarios: {
        db_load: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '15s', target: 10 },    // Ramp to 10 VUs
                { duration: '30s', target: 20 },    // Ramp to 20 VUs
                { duration: '30s', target: 20 },    // Hold at 20 VUs
                { duration: '15s', target: 0 },     // Ramp down
            ],
        },
    },
    thresholds: {
        ...STANDARD_THRESHOLDS,
        errors: ['rate<0.05'],               // Less than 5% errors
        db_response_time: ['p(95)<2000'],    // DB queries under 2s at p95
    },
};

export default function () {
    // health/detailed hits the database
    const res = http.get(ENDPOINTS.healthDetailed);

    dbResponseTime.add(res.timings.duration);

    const hasError = res.status >= 500;
    errorRate.add(hasError);

    check(res, {
        'status is not 5xx': (r) => r.status < 500,
        'response time < 2s': (r) => r.timings.duration < 2000,
    });

    if (res.status === 200) {
        check(res, {
            'database is healthy': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    const deps = body.data?.dependencies || body.dependencies || {};
                    return deps.database?.status === 'healthy';
                } catch {
                    return false;
                }
            },
        });
    }

    // Small delay to avoid hitting rate limit
    sleep(0.5);
}

export function handleSummary(data) {
    const totalRequests = data.metrics.http_reqs?.values?.count || 0;
    const errorPct = (data.metrics.errors?.values?.rate || 0) * 100;
    const p95 = data.metrics.db_response_time?.values?.['p(95)'] || 0;
    const p99 = data.metrics.db_response_time?.values?.['p(99)'] || 0;

    const report = {
        test: 'Database Connection Pooling',
        timestamp: new Date().toISOString(),
        results: {
            totalRequests,
            errorPct: errorPct.toFixed(2) + '%',
            p95ResponseMs: p95.toFixed(2),
            p99ResponseMs: p99.toFixed(2),
        },
        pass: errorPct < 5 && p95 < 2000,
    };

    return {
        'tests/load/results/database-pool.json': JSON.stringify(report, null, 2),
        stdout: JSON.stringify(report, null, 2) + '\n',
    };
}
