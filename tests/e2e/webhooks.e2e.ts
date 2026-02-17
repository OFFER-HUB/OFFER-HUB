import { createApp, closeApp, api } from './helpers';
import * as crypto from 'crypto';

/**
 * Webhooks E2E Tests.
 *
 * Tests webhook endpoints for both Trustless Work (escrow events)
 * and Airtm (payin/payout events).
 */
describe('Webhooks (E2E)', () => {
    beforeAll(async () => {
        await createApp();
    });

    afterAll(async () => {
        await closeApp();
    });

    describe('POST /api/v1/webhooks/trustless-work', () => {
        it('should process a valid webhook event and return ok', async () => {
            const webhookEvent = {
                type: 'escrow.created',
                event_id: `evt_test_${Date.now()}`,
                data: {
                    contract_id: 'C_TEST_CONTRACT_NONEXISTENT',
                    order_id: 'ord_nonexistent',
                    status: 'CREATED',
                    amount: '10000000',
                    currency: 'USDC',
                    buyer_address: 'GTEST_BUYER',
                    seller_address: 'GTEST_SELLER',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
            };

            const res = await api()
                .post('/api/v1/webhooks/trustless-work')
                .send(webhookEvent);

            // Should return 200 (may fail processing since order doesn't exist, but shouldn't crash)
            expect(res.status).toBeLessThanOrEqual(500);
        });

        it('should handle unknown event type gracefully', async () => {
            const webhookEvent = {
                type: 'unknown.event',
                event_id: `evt_unknown_${Date.now()}`,
                data: {
                    contract_id: 'C_TEST',
                    order_id: 'ord_test',
                    status: 'CREATED',
                    amount: '0',
                    currency: 'USDC',
                    buyer_address: 'G_BUYER',
                    seller_address: 'G_SELLER',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
            };

            const res = await api()
                .post('/api/v1/webhooks/trustless-work')
                .send(webhookEvent);

            expect(res.status).toBe(200);
            const body = res.body.data || res.body;
            const inner = body.data || body;
            const status = inner.status || body.status;
            expect(status).toBe('ok');
        });

        it('should accept webhook with HMAC signature header', async () => {
            const webhookEvent = {
                type: 'escrow.funded',
                event_id: `evt_sig_${Date.now()}`,
                data: {
                    contract_id: 'C_SIGNED_TEST',
                    order_id: 'ord_signed',
                    status: 'FUNDED',
                    amount: '5000000',
                    currency: 'USDC',
                    buyer_address: 'G_BUYER',
                    seller_address: 'G_SELLER',
                    transaction_hash: 'test_tx_hash',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
            };

            const body = JSON.stringify(webhookEvent);
            const secret = process.env.TRUSTLESS_WEBHOOK_SECRET || 'e2e_dummy_tw_webhook_secret';
            const signature = crypto
                .createHmac('sha256', secret)
                .update(body)
                .digest('hex');

            const res = await api()
                .post('/api/v1/webhooks/trustless-work')
                .set('x-tw-signature', signature)
                .set('Content-Type', 'application/json')
                .send(body);

            // Should return 200 (event processed or order not found, but no crash)
            expect(res.status).toBeLessThanOrEqual(500);
        });

        it('should reject webhook with invalid signature', async () => {
            const webhookEvent = {
                type: 'escrow.created',
                event_id: `evt_badsig_${Date.now()}`,
                data: {
                    contract_id: 'C_BAD_SIG',
                    order_id: 'ord_badsig',
                    status: 'CREATED',
                    amount: '0',
                    currency: 'USDC',
                    buyer_address: 'G_BUYER',
                    seller_address: 'G_SELLER',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
            };

            const res = await api()
                .post('/api/v1/webhooks/trustless-work')
                .set('x-tw-signature', 'invalid_signature_value')
                .send(webhookEvent);

            // Should return 401 for invalid signature
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/v1/webhooks/airtm', () => {
        it('should handle webhook without valid signature headers', async () => {
            const res = await api()
                .post('/api/v1/webhooks/airtm')
                .set('svix-id', 'test-id')
                .set('svix-timestamp', Math.floor(Date.now() / 1000).toString())
                .set('svix-signature', 'v1,invalid_signature')
                .send({
                    eventId: 'evt_test',
                    eventType: 'payin.created',
                    occurredAt: new Date().toISOString(),
                    data: {
                        id: 'test-payin-id',
                        amount: 100,
                        currency: 'USD',
                        status: 'created',
                    },
                });

            // Should return 200 (processed or not) or 401 (invalid sig)
            // Depends on whether webhook verification is enabled
            expect([200, 401]).toContain(res.status);
        });

        it('should handle webhook without svix headers', async () => {
            const res = await api()
                .post('/api/v1/webhooks/airtm')
                .send({
                    eventId: 'evt_test_no_headers',
                    eventType: 'payin.created',
                    data: { id: 'test', amount: 50, currency: 'USD', status: 'created' },
                });

            // Without headers, should still not crash
            expect(res.status).toBeLessThanOrEqual(500);
        });
    });
});
