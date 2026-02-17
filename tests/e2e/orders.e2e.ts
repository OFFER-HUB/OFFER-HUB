import { createApp, closeApp, api } from './helpers';
import { getApiKey } from './helpers/auth';

/**
 * Extract nested data from API responses.
 * Orders controller returns { success, data: X } which ResponseInterceptor
 * wraps into { data: { success, data: X }, meta: {...} }.
 */
function extractData(body: any): any {
    const wrapper = body.data || body;
    return wrapper.data || wrapper;
}

describe('Orders Lifecycle (E2E)', () => {
    let apiKey: string;
    let buyerId: string;
    let sellerId: string;

    beforeAll(async () => {
        await createApp();
        apiKey = await getApiKey();

        // Create buyer
        const buyerRes = await api()
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({
                externalUserId: `e2e-order-buyer-${Date.now()}`,
                email: `order-buyer-${Date.now()}@e2e-test.com`,
                type: 'BUYER',
            });
        buyerId = (buyerRes.body.data || buyerRes.body).id;

        // Create seller
        const sellerRes = await api()
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({
                externalUserId: `e2e-order-seller-${Date.now()}`,
                email: `order-seller-${Date.now()}@e2e-test.com`,
                type: 'SELLER',
            });
        sellerId = (sellerRes.body.data || sellerRes.body).id;

        // Credit buyer balance for order operations
        await api()
            .post(`/api/v1/users/${buyerId}/balance/credit`)
            .set('Authorization', `Bearer ${apiKey}`)
            .send({
                amount: '500.00',
                description: 'E2E order test funds',
                reference: `e2e-order-credit-${Date.now()}`,
            });
    });

    afterAll(async () => {
        await closeApp();
    });

    describe('POST /api/v1/orders', () => {
        it('should create an order', async () => {
            const res = await api()
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    buyer_id: buyerId,
                    seller_id: sellerId,
                    amount: '100.00',
                    title: 'E2E Test Order',
                    description: 'Testing order creation',
                });

            expect(res.status).toBe(201);
            const data = extractData(res.body);
            expect(data.id).toMatch(/^ord_/);
            expect(data.status).toBe('ORDER_CREATED');
        });

        it('should create an order with milestones', async () => {
            const res = await api()
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    buyer_id: buyerId,
                    seller_id: sellerId,
                    amount: '100.00',
                    title: 'E2E Milestone Order',
                    milestones: [
                        { milestone_ref: 'design', title: 'Design phase', amount: '40.00' },
                        { milestone_ref: 'dev', title: 'Development', amount: '60.00' },
                    ],
                });

            expect(res.status).toBe(201);
            const data = extractData(res.body);
            expect(data.id).toMatch(/^ord_/);
        });

        it('should reject order without buyer_id', async () => {
            const res = await api()
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    seller_id: sellerId,
                    amount: '100.00',
                    title: 'Missing buyer',
                });

            expect(res.status).toBe(400);
        });

        it('should reject order with same buyer and seller', async () => {
            const res = await api()
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    buyer_id: buyerId,
                    seller_id: buyerId,
                    amount: '100.00',
                    title: 'Self order',
                });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('GET /api/v1/orders', () => {
        it('should list orders', async () => {
            const res = await api()
                .get('/api/v1/orders')
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
            // Response: { data: { success, data: Order[], hasMore }, meta }
            const inner = res.body.data || res.body;
            const items = inner.data || inner;
            expect(Array.isArray(items)).toBe(true);
        });

        it('should filter orders by buyer_id', async () => {
            const res = await api()
                .get(`/api/v1/orders?buyer_id=${buyerId}`)
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
        });
    });

    describe('Order Reserve Flow', () => {
        let orderId: string;

        beforeAll(async () => {
            const res = await api()
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    buyer_id: buyerId,
                    seller_id: sellerId,
                    amount: '50.00',
                    title: 'E2E Reserve Test Order',
                });
            orderId = extractData(res.body).id;
        });

        it('should reserve funds for order', async () => {
            const res = await api()
                .post(`/api/v1/orders/${orderId}/reserve`)
                .set('Authorization', `Bearer ${apiKey}`);

            expect([200, 201]).toContain(res.status);
        });

        it('should update order status after reserve', async () => {
            const res = await api()
                .get(`/api/v1/orders/${orderId}`)
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
            const data = extractData(res.body);
            expect(data.status).toBe('FUNDS_RESERVED');
        });

        it('should reject double reserve', async () => {
            const res = await api()
                .post(`/api/v1/orders/${orderId}/reserve`)
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('Order Cancel Flow', () => {
        it('should cancel a CREATED order', async () => {
            const createRes = await api()
                .post('/api/v1/orders')
                .set('Authorization', `Bearer ${apiKey}`)
                .send({
                    buyer_id: buyerId,
                    seller_id: sellerId,
                    amount: '25.00',
                    title: 'E2E Cancel Test',
                });

            const orderId = extractData(createRes.body).id;

            const cancelRes = await api()
                .post(`/api/v1/orders/${orderId}/cancel`)
                .set('Authorization', `Bearer ${apiKey}`);

            expect([200, 201]).toContain(cancelRes.status);

            // Verify status
            const getRes = await api()
                .get(`/api/v1/orders/${orderId}`)
                .set('Authorization', `Bearer ${apiKey}`);

            const data = extractData(getRes.body);
            expect(data.status).toBe('CLOSED');
        });
    });
});
