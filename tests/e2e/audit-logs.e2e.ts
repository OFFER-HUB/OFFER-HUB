import { createApp, closeApp, api } from './helpers';
import { getApiKey } from './helpers/auth';

/**
 * Extract nested data from API responses.
 */
function extractData(body: any): any {
    const wrapper = body.data || body;
    return wrapper.data || wrapper;
}

describe('Audit Logs (E2E)', () => {
    let apiKey: string;

    beforeAll(async () => {
        await createApp();
        apiKey = await getApiKey();

        // Create a user to generate audit log entries
        await api()
            .post('/api/v1/users')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({
                externalUserId: `e2e-audit-user-${Date.now()}`,
                email: `audit-user-${Date.now()}@e2e-test.com`,
                type: 'BUYER',
            });
    }, 60000);

    afterAll(async () => {
        await closeApp();
    });

    describe('GET /api/v1/audit/logs', () => {
        it('should return audit log entries', async () => {
            const res = await api()
                .get('/api/v1/audit/logs')
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
            const body = extractData(res.body);
            // Response has data array and pagination
            if (body.data) {
                expect(Array.isArray(body.data)).toBe(true);
                expect(body.pagination).toBeDefined();
            } else {
                // May be the array directly
                expect(Array.isArray(body)).toBe(true);
            }
        });

        it('should support limit parameter', async () => {
            const res = await api()
                .get('/api/v1/audit/logs?limit=5')
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
        });

        it('should support filtering by resourceType', async () => {
            const res = await api()
                .get('/api/v1/audit/logs?resourceType=user')
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
        });

        it('should support filtering by action', async () => {
            const res = await api()
                .get('/api/v1/audit/logs?action=CREATE')
                .set('Authorization', `Bearer ${apiKey}`);

            expect(res.status).toBe(200);
        });

        it('should reject unauthenticated request', async () => {
            const res = await api()
                .get('/api/v1/audit/logs');

            expect(res.status).toBe(401);
        });
    });
});
