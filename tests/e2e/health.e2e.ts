import { createApp, closeApp, api, masterKey } from './helpers';

describe('Health & Smoke (E2E)', () => {
    beforeAll(async () => {
        await createApp();
    });

    afterAll(async () => {
        await closeApp();
    });

    describe('GET /api/v1/health', () => {
        it('should return healthy status', async () => {
            const res = await api().get('/api/v1/health');

            expect(res.status).toBe(200);
            const body = res.body.data || res.body;
            expect(body.status).toBe('healthy');
            expect(body.timestamp).toBeDefined();
        });

        it('should include rate limit headers', async () => {
            const res = await api().get('/api/v1/health');

            expect(res.status).toBe(200);
            expect(res.headers['x-ratelimit-limit']).toBeDefined();
            expect(res.headers['x-ratelimit-remaining']).toBeDefined();
        });
    });

    describe('Authentication', () => {
        it('should reject requests without auth on protected endpoints', async () => {
            // Users endpoint requires ApiKeyGuard
            const res = await api().post('/api/v1/users').send({});

            expect(res.status).toBe(401);
        });

        it('should reject invalid API key', async () => {
            const res = await api()
                .post('/api/v1/users')
                .set('Authorization', `Bearer ohk_test_intentionally_invalid`)
                .send({});

            expect(res.status).toBe(401);
        });

        it('should create API key with master key', async () => {
            const res = await api()
                .post('/api/v1/auth/api-keys')
                .set('Authorization', `Bearer ${masterKey()}`)
                .send({
                    name: 'Health E2E Key',
                    scopes: ['orders', 'users', 'balance'],
                });

            expect(res.status).toBe(201);
            const data = res.body.data || res.body;
            expect(data.key).toBeDefined();
            expect(data.key).toContain('ohk_');
        });

        it('should reject master key creation without master key', async () => {
            const res = await api()
                .post('/api/v1/auth/api-keys')
                .send({
                    name: 'Unauthorized Key',
                    scopes: ['orders'],
                });

            expect(res.status).toBe(401);
        });
    });
});
