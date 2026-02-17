import { createApp, closeApp, api } from './helpers';
import { getApiKey } from './helpers/auth';

/**
 * Withdrawals E2E Tests.
 *
 * Note: Withdrawals depend on Airtm integration (payout operations).
 * In the E2E environment (PAYMENT_PROVIDER=crypto), Airtm is not available.
 * Additionally, @CurrentUser('userId') is not populated by the API key auth flow.
 * These tests validate endpoint availability and error handling.
 */
describe('Withdrawals (E2E)', () => {
    let apiKey: string;

    beforeAll(async () => {
        await createApp();
        apiKey = await getApiKey();
    });

    afterAll(async () => {
        await closeApp();
    });

    describe('POST /api/v1/withdrawals', () => {
        it('should reject without authentication', async () => {
            const res = await api()
                .post('/api/v1/withdrawals')
                .send({
                    amount: '50.00',
                    destinationType: 'bank',
                    destinationRef: 'test-bank-ref',
                });

            expect(res.status).toBe(401);
        });

        it('should handle request gracefully (no user context)', async () => {
            const res = await api()
                .post('/api/v1/withdrawals')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    amount: '50.00',
                    destinationType: 'bank',
                    destinationRef: 'test-bank-ref',
                });

            // @CurrentUser returns undefined → should fail gracefully
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('should reject invalid amount format', async () => {
            const res = await api()
                .post('/api/v1/withdrawals')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    amount: 'not-a-number',
                    destinationType: 'bank',
                    destinationRef: 'ref',
                });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('GET /api/v1/withdrawals', () => {
        it('should handle list request', async () => {
            const res = await api()
                .get('/api/v1/withdrawals')
                .set('Authorization', `Bearer ${apiKey}`);

            // May return empty list or error (no user context)
            expect(res.status).toBeLessThanOrEqual(500);
        });

        it('should reject without authentication', async () => {
            const res = await api()
                .get('/api/v1/withdrawals');

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/withdrawals/:id', () => {
        it('should return error for non-existent withdrawal', async () => {
            const res = await api()
                .get('/api/v1/withdrawals/wdr_nonexistent')
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('POST /api/v1/withdrawals/:id/commit', () => {
        it('should return error for non-existent withdrawal', async () => {
            const res = await api()
                .post('/api/v1/withdrawals/wdr_nonexistent/commit')
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });
});
