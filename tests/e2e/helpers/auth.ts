import { api, masterKey } from './app';

let cachedApiKey: string | null = null;

/**
 * Create an API key using the master key.
 * Caches the result for the test session.
 */
export async function getApiKey(): Promise<string> {
    if (cachedApiKey) return cachedApiKey;

    const res = await api()
        .post('/api/v1/auth/api-keys')
        .set('Authorization', `Bearer ${masterKey()}`)
        .send({
            name: 'E2E Test Key',
            scopes: ['*'],
        });

    if (res.status === 201 || res.status === 200) {
        const data = res.body.data || res.body;
        cachedApiKey = data.key || data.apiKey;
        return cachedApiKey!;
    }

    throw new Error(`Failed to create API key: ${res.status} ${JSON.stringify(res.body)}`);
}

/**
 * Reset cached API key (for tests that need a fresh key).
 */
export function resetApiKey(): void {
    cachedApiKey = null;
}

/**
 * Set auth header on a supertest request using the cached API key.
 */
export async function withAuth(req: any): Promise<any> {
    const key = await getApiKey();
    return req.set('Authorization', `Bearer ${key}`);
}
