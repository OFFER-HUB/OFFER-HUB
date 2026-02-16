import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { ENDPOINTS, authHeaders, BASE_URL, API_PREFIX } from './config.js';

/**
 * BullMQ Job Processing Under Load Test
 *
 * Creates multiple users concurrently to exercise background job queues
 * (wallet creation, event emission). Requires API_KEY environment variable.
 *
 * Run: API_KEY=ohk_your_key k6 run tests/load/job-processing.js
 */

const userCreateSuccess = new Counter('user_create_success');
const userCreateFailed = new Counter('user_create_failed');
const errorRate = new Rate('errors');
const createTime = new Trend('user_create_time');

export const options = {
    scenarios: {
        create_users: {
            executor: 'ramping-arrival-rate',
            startRate: 5,
            timeUnit: '1s',
            stages: [
                { duration: '10s', target: 10 },   // Ramp to 10/s
                { duration: '20s', target: 10 },   // Hold at 10/s
                { duration: '10s', target: 0 },    // Ramp down
            ],
            preAllocatedVUs: 20,
            maxVUs: 50,
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<2000'],   // Under 2s for writes
        errors: ['rate<0.20'],                // Allow some rate-limited failures
        user_create_time: ['p(95)<3000'],
    },
};

export default function () {
    const uniqueId = `load-test-${__VU}-${__ITER}-${Date.now()}`;

    const payload = JSON.stringify({
        externalUserId: uniqueId,
        email: `${uniqueId}@loadtest.example.com`,
        type: 'BUYER',
    });

    const res = http.post(
        `${BASE_URL}${API_PREFIX}/users`,
        payload,
        { headers: authHeaders() },
    );

    createTime.add(res.timings.duration);

    if (res.status === 201 || res.status === 200) {
        userCreateSuccess.add(1);
        errorRate.add(false);

        check(res, {
            'user created with id': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    const data = body.data || body;
                    return data.id?.startsWith('usr_') || data.userId?.startsWith('usr_');
                } catch {
                    return false;
                }
            },
        });
    } else if (res.status === 429) {
        // Rate limited — expected under load, not a test failure
        errorRate.add(false);
    } else {
        userCreateFailed.add(1);
        errorRate.add(true);
    }

    check(res, {
        'no server errors': (r) => r.status < 500,
    });

    sleep(0.1);
}

export function handleSummary(data) {
    const totalRequests = data.metrics.http_reqs?.values?.count || 0;
    const created = data.metrics.user_create_success?.values?.count || 0;
    const failed = data.metrics.user_create_failed?.values?.count || 0;
    const p95 = data.metrics.user_create_time?.values?.['p(95)'] || 0;

    const report = {
        test: 'BullMQ Job Processing Under Load',
        timestamp: new Date().toISOString(),
        results: {
            totalRequests,
            usersCreated: created,
            failedCreations: failed,
            p95CreateTimeMs: p95.toFixed(2),
        },
        pass: p95 < 3000 && failed < totalRequests * 0.2,
    };

    return {
        'tests/load/results/job-processing.json': JSON.stringify(report, null, 2),
        stdout: JSON.stringify(report, null, 2) + '\n',
    };
}
