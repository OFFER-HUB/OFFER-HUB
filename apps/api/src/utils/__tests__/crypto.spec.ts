import { encrypt, decrypt } from '../crypto';
import * as crypto from 'crypto';

// Use a consistent test encryption key
const TEST_KEY = crypto.randomBytes(32).toString('hex');

describe('CryptoUtils', () => {
    beforeAll(() => {
        process.env.WALLET_ENCRYPTION_KEY = TEST_KEY;
    });

    afterAll(() => {
        delete process.env.WALLET_ENCRYPTION_KEY;
    });

    describe('encrypt/decrypt round-trip', () => {
        it('should encrypt and decrypt a Stellar secret key', () => {
            // Generate a fake Stellar-like secret for testing (not a real key)
            const secret = 'S' + crypto.randomBytes(28).toString('base64').replace(/[^A-Z2-7]/g, 'A').slice(0, 55);
            const encrypted = encrypt(secret);
            const decrypted = decrypt(encrypted);
            expect(decrypted).toBe(secret);
        });

        it('should encrypt and decrypt an empty string', () => {
            const encrypted = encrypt('');
            const decrypted = decrypt(encrypted);
            expect(decrypted).toBe('');
        });

        it('should encrypt and decrypt a long string', () => {
            const long = 'A'.repeat(1000);
            const encrypted = encrypt(long);
            const decrypted = decrypt(encrypted);
            expect(decrypted).toBe(long);
        });

        it('should produce format iv:authTag:ciphertext', () => {
            const encrypted = encrypt('test');
            const parts = encrypted.split(':');
            expect(parts).toHaveLength(3);
            // IV = 16 bytes = 32 hex chars
            expect(parts[0]).toHaveLength(32);
            // Auth tag = 16 bytes = 32 hex chars
            expect(parts[1]).toHaveLength(32);
            // Ciphertext is non-empty hex
            expect(parts[2].length).toBeGreaterThan(0);
        });
    });

    describe('IV randomness', () => {
        it('should produce different ciphertexts for same plaintext', () => {
            const text = 'same-plaintext';
            const encrypted1 = encrypt(text);
            const encrypted2 = encrypt(text);
            expect(encrypted1).not.toBe(encrypted2);
            // But both should decrypt to same value
            expect(decrypt(encrypted1)).toBe(text);
            expect(decrypt(encrypted2)).toBe(text);
        });
    });

    describe('tampered data detection', () => {
        it('should throw on invalid format', () => {
            expect(() => decrypt('not-valid-format')).toThrow('Invalid encrypted format');
        });

        it('should throw on tampered ciphertext', () => {
            const encrypted = encrypt('test-data');
            const parts = encrypted.split(':');
            // Flip a character in the ciphertext
            const tampered = `${parts[0]}:${parts[1]}:ff${parts[2].slice(2)}`;
            expect(() => decrypt(tampered)).toThrow();
        });

        it('should throw on tampered auth tag', () => {
            const encrypted = encrypt('test-data');
            const parts = encrypted.split(':');
            const tampered = `${parts[0]}:${'00'.repeat(16)}:${parts[2]}`;
            expect(() => decrypt(tampered)).toThrow();
        });

        it('should throw on invalid IV length', () => {
            expect(() => decrypt('aabb:' + '00'.repeat(16) + ':ccdd')).toThrow('Invalid IV length');
        });
    });

    describe('missing/invalid key', () => {
        it('should throw if WALLET_ENCRYPTION_KEY is not set', () => {
            const original = process.env.WALLET_ENCRYPTION_KEY;
            delete process.env.WALLET_ENCRYPTION_KEY;
            expect(() => encrypt('test')).toThrow('WALLET_ENCRYPTION_KEY is not set');
            process.env.WALLET_ENCRYPTION_KEY = original;
        });

        it('should throw if key is wrong length', () => {
            const original = process.env.WALLET_ENCRYPTION_KEY;
            process.env.WALLET_ENCRYPTION_KEY = 'aabb'; // Too short
            expect(() => encrypt('test')).toThrow('must be 32 bytes');
            process.env.WALLET_ENCRYPTION_KEY = original;
        });
    });

    describe('wrong key detection', () => {
        it('should fail to decrypt with a different key', () => {
            const encrypted = encrypt('secret-data');
            // Change to different key
            process.env.WALLET_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
            expect(() => decrypt(encrypted)).toThrow();
            // Restore
            process.env.WALLET_ENCRYPTION_KEY = TEST_KEY;
        });
    });
});
