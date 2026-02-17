/**
 * Shared configuration for k6 load tests.
 *
 * Usage:
 *   BASE_URL=http://localhost:4000 k6 run tests/load/sustained.js
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
export const API_PREFIX = '/api/v1';
export const API_KEY = __ENV.API_KEY || '';

export const ENDPOINTS = {
    health: `${BASE_URL}${API_PREFIX}/health`,
    healthDetailed: `${BASE_URL}${API_PREFIX}/health/detailed`,
    users: `${BASE_URL}${API_PREFIX}/users`,
    orders: `${BASE_URL}${API_PREFIX}/orders`,
};

export function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (API_KEY) {
        headers['x-api-key'] = API_KEY;
    }
    return headers;
}

/**
 * Standard thresholds for all load tests.
 */
export const STANDARD_THRESHOLDS = {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],
};
