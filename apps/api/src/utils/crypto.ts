/**
 * AES-256-GCM encryption utilities for Stellar private keys.
 *
 * Format: iv:authTag:ciphertext (all hex-encoded)
 * Key: 32-byte hex string from WALLET_ENCRYPTION_KEY env var
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes is the recommended IV size for GCM
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.WALLET_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'WALLET_ENCRYPTION_KEY is not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) {
    throw new Error(
      `WALLET_ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${buf.length} bytes`,
    );
  }
  return buf;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * @returns Encrypted string in format: iv:authTag:ciphertext (hex)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt().
 * @param encrypted String in format: iv:authTag:ciphertext (hex)
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format. Expected iv:authTag:ciphertext');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: ${iv.length}, expected ${IV_LENGTH}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid auth tag length: ${authTag.length}, expected ${AUTH_TAG_LENGTH}`,
    );
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
