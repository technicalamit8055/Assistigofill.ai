/**
 * AES-256-GCM field encryption for high-risk values (PAN, bank account).
 * Master spec §18.1, §19.3.
 *
 * SERVER ONLY. This module imports node:crypto and is deliberately excluded from the
 * package's barrel export so it can never be pulled into the extension or a browser bundle.
 *
 * Ciphertext format: v1.<iv_b64>.<tag_b64>.<ciphertext_b64>
 * The version prefix exists so the key can be rotated without ambiguity about how a stored
 * value was produced.
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const KEY_LENGTH = 32; // 256 bits
const VERSION = 'v1';

export class EncryptionKeyError extends Error {
  readonly code = 'ENCRYPTION_KEY_INVALID';
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionKeyError';
  }
}

export class DecryptionError extends Error {
  readonly code = 'DECRYPTION_FAILED';
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

function loadKey(explicitKey?: string): Buffer {
  const raw = explicitKey ?? process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new EncryptionKeyError(
      "FIELD_ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new EncryptionKeyError('FIELD_ENCRYPTION_KEY must be base64 encoded.');
  }
  if (key.length !== KEY_LENGTH) {
    throw new EncryptionKeyError(
      `FIELD_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes, got ${key.length}.`,
    );
  }
  return key;
}

/**
 * @param plaintext the value to protect
 * @param aad additional authenticated data — pass a stable context string such as
 *            `${organizationId}:${customerId}:${fieldKey}` so a ciphertext cannot be
 *            transplanted onto a different customer's record.
 */
export function encryptField(plaintext: string, aad: string, key?: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, loadKey(key), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

export function decryptField(payload: string, aad: string, key?: string): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new DecryptionError('Unrecognised ciphertext format.');
  }
  const [, ivB64, tagB64, ctB64] = parts as [string, string, string, string];
  try {
    const decipher = createDecipheriv(ALGORITHM, loadKey(key), Buffer.from(ivB64, 'base64'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch (error) {
    if (error instanceof EncryptionKeyError) throw error;
    // Never surface the underlying reason: it distinguishes "wrong key" from "tampered".
    throw new DecryptionError('Could not decrypt field value.');
  }
}

export function isEncryptedPayload(value: string | null | undefined): boolean {
  return (
    typeof value === 'string' && value.startsWith(`${VERSION}.`) && value.split('.').length === 4
  );
}

/** Constant-time compare, for pairing codes and webhook signatures. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
