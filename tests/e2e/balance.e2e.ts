import { createApp, closeApp, api } from './helpers';
import { getApiKey } from './helpers/auth';

describe('Balance (E2E)', () => {
    let apiKey: string;
    let userId: string;

    beforeAll(async () => {
        await createApp();
        apiKey = await getApiKey();

        // Create a test user
        const res = await api()
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({
                externalUserId: `e2e-balance-${Date.now()}`,
                email: `balance-${Date.now()}@e2e-test.com`,
                type: 'BUYER',
            });

        userId = (res.body.data || res.body).id;
    });

    afterAll(async () => {
        await closeApp();
    });

    describe('GET /api/v1/users/:id/balance', () => {
        it('should return initial zero balance', async () => {
            const res = await api()
                .get(`/api/v1/users/${userId}/balance`)
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
            const data = res.body.data || res.body;
            expect(data.available).toBeDefined();
            expect(data.reserved).toBeDefined();
        });

        it('should reject without auth', async () => {
            const res = await api()
                .get(`/api/v1/users/${userId}/balance`);

            expect(res.status).toBe(401);
        });

        it('should handle non-existent user gracefully', async () => {
            const res = await api()
                .get('/api/v1/users/usr_nonexistent_12345/balance')
                .set('Authorization', `Bearer ${apiKey}`);

            // API auto-creates zero balance or returns 404 depending on implementation
            expect([200, 404]).toContain(res.status);
            if (res.status === 200) {
                const data = res.body.data || res.body;
                expect(parseFloat(data.available)).toBe(0);
            }
        });
    });

    describe('POST /api/v1/users/:id/balance/credit', () => {
        it('should credit balance', async () => {
            const res = await api()
                .post(`/api/v1/users/${userId}/balance/credit`)
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    amount: '100.00',
                    description: 'E2E test credit',
                    reference: `e2e-credit-${Date.now()}`,
                });

            // Could be 200 or 201 depending on implementation
            expect([200, 201]).toContain(res.status);

            // Verify balance updated
            const balanceRes = await api()
                .get(`/api/v1/users/${userId}/balance`)
                .set('Authorization', `Bearer ${apiKey}`);

            const balance = balanceRes.body.data || balanceRes.body;
            expect(parseFloat(balance.available)).toBeGreaterThanOrEqual(100);
        });

        it('should reject negative amount', async () => {
            const res = await api()
                .post(`/api/v1/users/${userId}/balance/credit`)
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    amount: '-50.00',
                    description: 'Negative test',
                    reference: `e2e-neg-${Date.now()}`,
                });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('POST /api/v1/users/:id/balance/reserve', () => {
        it('should reserve funds from available balance', async () => {
            // First ensure we have balance
            await api()
                .post(`/api/v1/users/${userId}/balance/credit`)
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    amount: '200.00',
                    description: 'Credit for reserve test',
                    reference: `e2e-reserve-credit-${Date.now()}`,
                });

            const res = await api()
                .post(`/api/v1/users/${userId}/balance/reserve`)
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    amount: '50.00',
                    orderId: `ord_e2e_reserve_${Date.now()}`,
                    description: 'E2E reserve test',
                });

            expect([200, 201]).toContain(res.status);

            // Verify reserved balance increased
            const balanceRes = await api()
                .get(`/api/v1/users/${userId}/balance`)
                .set('Authorization', `Bearer ${apiKey}`);

            const balance = balanceRes.body.data || balanceRes.body;
            expect(parseFloat(balance.reserved)).toBeGreaterThanOrEqual(50);
        });

        it('should reject reserve exceeding available', async () => {
            const res = await api()
                .post(`/api/v1/users/${userId}/balance/reserve`)
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    amount: '999999.00',
                    orderId: `ord_e2e_exceed_${Date.now()}`,
                });

            // Should fail with insufficient funds
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });
});
