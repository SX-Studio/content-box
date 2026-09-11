import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { env } from '@/lib/env';

// Login-identifier protection primitives, shared by phone and email — both are
// equally private in this product.
//  - encrypt*/decrypt*: AES-256-GCM. Stored as iv(12) | tag(16) | ciphertext.
//  - *Hash: keyed HMAC-SHA256, so we can look an account up WITHOUT decrypting
//    anything (equality only — the point of the privacy model). Email hashes are
//    domain-separated from phone hashes so the two namespaces can never collide.
// Keys come from env as 64 hex chars (32 bytes).

function key32(hex: string, name: string): Buffer {
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) throw new Error(`${name} must be 32 bytes (64 hex chars)`);
  return buf;
}

function encryptString(plain: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key32(env.phoneEncryptionKey(), 'PHONE_ENCRYPTION_KEY'), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

function decryptString(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key32(env.phoneEncryptionKey(), 'PHONE_ENCRYPTION_KEY'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function encryptPhone(e164: string): Buffer {
  return encryptString(e164);
}

export function decryptPhone(blob: Buffer): string {
  return decryptString(blob);
}

export function encryptEmail(email: string): Buffer {
  return encryptString(email);
}

export function decryptEmail(blob: Buffer): string {
  return decryptString(blob);
}

// Postgres returns a bytea column as a `\x…` hex string over PostgREST; turn it
// back into the Buffer decrypt* expects.
export function fromBytea(hexLiteral: string): Buffer {
  return Buffer.from(hexLiteral.replace(/^\\x/, ''), 'hex');
}

export function phoneHash(e164: string): string {
  return createHmac('sha256', key32(env.phoneHashKey(), 'PHONE_HASH_KEY')).update(e164).digest('hex');
}

// Prefixed so an email can never hash to the same value as a phone (or vice versa),
// even though both live in the same lookup namespace.
export function emailHash(email: string): string {
  return createHmac('sha256', key32(env.phoneHashKey(), 'PHONE_HASH_KEY')).update(`email:${email}`).digest('hex');
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

// Normalise a login email: trimmed + lowercased so the same address always yields the
// same hash. Throws (never returns null) — a login identifier is required, unlike the
// optional contact email in lib/accounts.
export function normalizeLoginEmail(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s || s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    throw new Error('Enter a valid email address, e.g. name@example.com');
  }
  return s;
}
