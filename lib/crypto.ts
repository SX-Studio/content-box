import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { env } from '@/lib/env';

// Phone-number protection primitives.
//  - encryptPhone/decryptPhone: AES-256-GCM. Stored as iv(12) | tag(16) | ciphertext.
//  - phoneHash: keyed HMAC-SHA256, so we can look an account up by phone WITHOUT
//    decrypting anything (equality only — the point of the privacy model).
// Keys come from env as 64 hex chars (32 bytes).

function key32(hex: string, name: string): Buffer {
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) throw new Error(`${name} must be 32 bytes (64 hex chars)`);
  return buf;
}

export function encryptPhone(e164: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key32(env.phoneEncryptionKey(), 'PHONE_ENCRYPTION_KEY'), iv);
  const ct = Buffer.concat([cipher.update(e164, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decryptPhone(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key32(env.phoneEncryptionKey(), 'PHONE_ENCRYPTION_KEY'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// Postgres returns a bytea column as a `\x…` hex string over PostgREST; turn it
// back into the Buffer decryptPhone expects.
export function fromBytea(hexLiteral: string): Buffer {
  return Buffer.from(hexLiteral.replace(/^\\x/, ''), 'hex');
}

export function phoneHash(e164: string): string {
  return createHmac('sha256', key32(env.phoneHashKey(), 'PHONE_HASH_KEY')).update(e164).digest('hex');
}

// Minimal E.164 normalisation for Phase 1 (strip spacing/punctuation, keep leading +).
// Replace with a full libphonenumber pass before accepting real traffic.
export function toE164(raw: string): string {
  const trimmed = raw.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
    throw new Error('Phone number must be in E.164 format, e.g. +32470123456');
  }
  return trimmed;
}
