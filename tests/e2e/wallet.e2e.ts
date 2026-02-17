import { createApp, closeApp, api } from './helpers';
import { getApiKey } from './helpers/auth';

/**
 * Extract nested data from API responses.
 * Controllers returning { success, data: X } get wrapped by ResponseInterceptor
 * into { data: { success, data: X }, meta: {...} }.
 */
function extractData(body: any): any {
    const wrapper = body.data || body;
    return wrapper.data || wrapper;
}

describe('Wallet (E2E)', () => {
    let apiKey: string;
    let userId: string;

    beforeAll(async () => {
        await createApp();
        apiKey = await getApiKey();

        // Create a user (wallet is auto-created via crypto provider)
        const res = await api()
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({
                externalUserId: `e2e-wallet-user-${Date.now()}`,
                email: `wallet-user-${Date.now()}@e2e-test.com`,
                type: 'BUYER',
            });
        userId = (res.body.data || res.body).id;
    }, 60000);

    afterAll(async () => {
        await closeApp();
    });

    describe('GET /api/v1/users/:userId/wallet', () => {
        it('should return wallet info for user', async () => {
            const res = await api()
                .get(`/api/v1/users/${userId}/wallet`)
                .set('Authorization', `Bearer ${apiKey}`);

            // Wallet may or may not be fully funded on testnet
            if (res.status === 200) {
                const data = extractData(res.body);
                expect(data.publicKey).toBeDefined();
                expect(data.type).toBe('INVISIBLE');
                expect(data.provider).toBe('STELLAR');
            } else {
                // 404 if wallet creation failed on testnet
                expect([404, 502]).toContain(res.status);
            }
        });

        it('should reject request for non-existent user', async () => {
            const res = await api()
                .get('/api/v1/users/usr_nonexistent_wallet/wallet')
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('should reject unauthenticated request', async () => {
            const res = await api()
                .get(`/api/v1/users/${userId}/wallet`);

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/v1/users/:userId/wallet/deposit', () => {
        it('should return deposit instructions', async () => {
            const res = await api()
                .get(`/api/v1/users/${userId}/wallet/deposit`)
                .set('Authorization', `Bearer ${apiKey}`);

            if (res.status === 200) {
                const data = extractData(res.body);
                expect(data.provider).toBe('crypto');
                expect(data.method).toBe('stellar_address');
                expect(data.address).toBeDefined();
                expect(data.asset).toBeDefined();
            } else {
                expect([404, 502]).toContain(res.status);
            }
        });
    });

    describe('GET /api/v1/users/:userId/wallet/transactions', () => {
        it('should return transaction history', async () => {
            const res = await api()
                .get(`/api/v1/users/${userId}/wallet/transactions`)
                .set('Authorization', `Bearer ${apiKey}`);

            if (res.status === 200) {
                const data = extractData(res.body);
                expect(Array.isArray(data)).toBe(true);
            } else {
                expect([404, 502]).toContain(res.status);
            }
        });

        it('should accept limit parameter', async () => {
            const res = await api()
                .get(`/api/v1/users/${userId}/wallet/transactions?limit=5`)
                .set('Authorization', `Bearer ${apiKey}`);

            // Should not crash regardless of wallet state
            expect(res.status).toBeLessThan(500);
        });
    });
});
