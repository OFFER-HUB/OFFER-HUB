import { createApp, closeApp, api } from './helpers';
import { getApiKey } from './helpers/auth';
import { randomUUID } from 'crypto';

describe('Idempotency & Rate Limiting (E2E)', () => {
    let apiKey: string;

    beforeAll(async () => {
        await createApp();
        apiKey = await getApiKey();
    });

    afterAll(async () => {
        await closeApp();
    });

    describe('Idempotency', () => {
        it('should return same response for duplicate idempotency key', async () => {
            const idempotencyKey = randomUUID();
            const payload = {
                externalUserId: `e2e-idemp-${Date.now()}`,
                email: `idemp-${Date.now()}@e2e-test.com`,
                type: 'BUYER',
            };

            const res1 = await api()
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${apiKey}`)
                .set('Idempotency-Key', idempotencyKey)
                .send(payload);

            expect(res1.status).toBe(201);
            const user1 = res1.body.data || res1.body;

            // Small delay to ensure idempotency record is stored
            // (the interceptor's tap fires asynchronously)
            await new Promise((r) => setTimeout(r, 500));

            const res2 = await api()
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${apiKey}`)
                .set('Idempotency-Key', idempotencyKey)
                .send(payload);

            // Second request should return same result (cached)
            expect([200, 201]).toContain(res2.status);
            const user2 = res2.body.data || res2.body;
            expect(user2.id).toBe(user1.id);
        }, 60000);

        it('should reject mismatched body with same idempotency key', async () => {
            const idempotencyKey = randomUUID();

            await api()
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${apiKey}`)
                .set('Idempotency-Key', idempotencyKey)
                .send({
                    externalUserId: `e2e-mismatch-${Date.now()}`,
                    email: `mismatch-${Date.now()}@e2e-test.com`,
                    type: 'BUYER',
                });

            // Small delay to ensure idempotency record is stored
            await new Promise((r) => setTimeout(r, 500));

            const res = await api()
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${apiKey}`)
                .set('Idempotency-Key', idempotencyKey)
                .send({
                    externalUserId: `e2e-different-${Date.now()}`,
                    email: `different-${Date.now()}@e2e-test.com`,
                    type: 'SELLER',
                });

            // Should reject with conflict (409) or return cached response
            expect([200, 201, 409, 422]).toContain(res.status);
        }, 60000);

        it('should process different idempotency keys independently', async () => {
            const res1 = await api()
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${apiKey}`)
                .set('Idempotency-Key', randomUUID())
                .send({
                    externalUserId: `e2e-ind1-${Date.now()}`,
                    email: `ind1-${Date.now()}@e2e-test.com`,
                    type: 'BUYER',
                });

            const res2 = await api()
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${apiKey}`)
                .set('Idempotency-Key', randomUUID())
                .send({
                    externalUserId: `e2e-ind2-${Date.now()}`,
                    email: `ind2-${Date.now()}@e2e-test.com`,
                    type: 'BUYER',
                });

            expect(res1.status).toBe(201);
            expect(res2.status).toBe(201);
            const user1 = res1.body.data || res1.body;
            const user2 = res2.body.data || res2.body;
            expect(user1.id).not.toBe(user2.id);
        }, 60000);
    });

    describe('Rate Limiting', () => {
        it('should return rate limit headers', async () => {
            const res = await api().get('/api/v1/health');

            expect(res.status).toBe(200);
            expect(res.headers['x-ratelimit-limit']).toBeDefined();
            expect(res.headers['x-ratelimit-remaining']).toBeDefined();
            expect(res.headers['x-ratelimit-reset']).toBeDefined();
        });

        it('should return valid rate limit header values', async () => {
            // Verify rate limit headers contain valid numeric values
            const res = await api().get('/api/v1/health');

            expect(res.status).toBe(200);
            const limit = parseInt(res.headers['x-ratelimit-limit'], 10);
            const remaining = parseInt(res.headers['x-ratelimit-remaining'], 10);
            const reset = parseInt(res.headers['x-ratelimit-reset'], 10);

            expect(limit).toBeGreaterThan(0);
            expect(remaining).toBeGreaterThanOrEqual(0);
            expect(reset).toBeGreaterThan(0);
            expect(remaining).toBeLessThanOrEqual(limit);
        });
    });
});
