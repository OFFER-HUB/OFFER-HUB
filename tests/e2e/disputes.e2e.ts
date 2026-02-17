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

describe('Disputes (E2E)', () => {
    let apiKey: string;
    let buyerId: string;
    let sellerId: string;
    let reservedOrderId: string;

    beforeAll(async () => {
        await createApp();
        apiKey = await getApiKey();

        // Create buyer and seller (wallet creation on Stellar testnet is slow)
        const buyerRes = await api()
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({
                externalUserId: `e2e-dispute-buyer-${Date.now()}`,
                email: `dispute-buyer-${Date.now()}@e2e-test.com`,
                type: 'BUYER',
            });
        buyerId = (buyerRes.body.data || buyerRes.body).id;

        const sellerRes = await api()
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({
                externalUserId: `e2e-dispute-seller-${Date.now()}`,
                email: `dispute-seller-${Date.now()}@e2e-test.com`,
                type: 'SELLER',
            });
        sellerId = (sellerRes.body.data || sellerRes.body).id;

        // Credit buyer
        await api()
            .post(`/api/v1/users/${buyerId}/balance/credit`)
            .set('Authorization', `Bearer ${apiKey}`)
            .send({
                amount: '500.00',
                description: 'Dispute test funds',
                reference: `e2e-dispute-credit-${Date.now()}`,
            });

        // Create and reserve an order for dispute testing
        const orderRes = await api()
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({
                buyer_id: buyerId,
                seller_id: sellerId,
                amount: '100.00',
                title: 'E2E Dispute Order',
            });
        reservedOrderId = extractData(orderRes.body).id;

        await api()
            .post(`/api/v1/orders/${reservedOrderId}/reserve`)
            .set('Authorization', `Bearer ${apiKey}`);
    }, 60000);

    afterAll(async () => {
        await closeApp();
    });

    describe('Dispute State Validation', () => {
        it('should reject dispute on FUNDS_RESERVED order (requires IN_PROGRESS)', async () => {
            // Disputes can only be opened on IN_PROGRESS orders.
            // Reaching IN_PROGRESS requires the full escrow flow (external service).
            const res = await api()
                .post(`/api/v1/orders/${reservedOrderId}/resolution/dispute`)
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    orderId: reservedOrderId,
                    openedBy: 'BUYER',
                    reason: 'NOT_DELIVERED',
                    evidence: ['Screenshot evidence from E2E test'],
                });

            // Should fail because order is in FUNDS_RESERVED, not IN_PROGRESS
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('should reject dispute without required fields', async () => {
            const orderRes = await api()
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    buyer_id: buyerId,
                    seller_id: sellerId,
                    amount: '50.00',
                    title: 'E2E No-reason dispute',
                });
            const orderId = extractData(orderRes.body).id;
            await api()
                .post(`/api/v1/orders/${orderId}/reserve`)
                .set('Authorization', `Bearer ${apiKey}`);

            const res = await api()
                .post(`/api/v1/orders/${orderId}/resolution/dispute`)
                .set('Authorization', `Bearer ${apiKey}`)
                .send({});

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('Dispute on invalid order state', () => {
        it('should reject dispute on ORDER_CREATED (not yet reserved) order', async () => {
            const orderRes = await api()
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    buyer_id: buyerId,
                    seller_id: sellerId,
                    amount: '30.00',
                    title: 'E2E unreserved dispute attempt',
                });
            const orderId = extractData(orderRes.body).id;

            const res = await api()
                .post(`/api/v1/orders/${orderId}/resolution/dispute`)
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    orderId: orderId,
                    openedBy: 'BUYER',
                    reason: 'NOT_DELIVERED',
                });

            // Should fail because order is in ORDER_CREATED status
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });
});
