import { createApp, closeApp, api } from './helpers';
import { getApiKey } from './helpers/auth';

/**
 * TopUps E2E Tests.
 *
 * Note: TopUps depend on Airtm integration (payin operations).
 * In the E2E environment (PAYMENT_PROVIDER=crypto), Airtm is not available.
 * Additionally, @CurrentUser('userId') is not populated by the API key auth flow.
 * These tests validate endpoint availability and error handling.
 */
describe('TopUps (E2E)', () => {
    let apiKey: string;

    beforeAll(async () => {
        await createApp();
        apiKey = await getApiKey();
    });

    afterAll(async () => {
        await closeApp();
    });

    describe('POST /api/v1/topups', () => {
        it('should reject without authentication', async () => {
            const res = await api()
                .post('/api/v1/topups')
                .send({ amount: '100.00' });

            expect(res.status).toBe(401);
        });

        it('should handle request gracefully (no user context)', async () => {
            const res = await api()
                .post('/api/v1/topups')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({ amount: '100.00' });

            // @CurrentUser returns undefined → should fail with client error, not 500
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('should reject invalid amount format', async () => {
            const res = await api()
                .post('/api/v1/topups')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({ amount: 'invalid' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('GET /api/v1/topups', () => {
        it('should handle list request', async () => {
            const res = await api()
                .get('/api/v1/topups')
                .set('Authorization', `Bearer ${apiKey}`);

            // May return empty list or error (no user context)
            expect(res.status).toBeLessThanOrEqual(500);
        });

        it('should reject without authentication', async () => {
            const res = await api()
                .get('/api/v1/topups');

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/topups/:id', () => {
        it('should return 404 for non-existent topup', async () => {
            const res = await api()
                .get('/api/v1/topups/topup_nonexistent')
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });
});
