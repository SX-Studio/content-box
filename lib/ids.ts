import { randomBytes } from 'crypto';

// Public, human-readable identifiers (USR-… / CRT-… / BOX-… / CNT-… / INV-…).
// These are what participants see; the internal UUID primary key is never exposed.
// Crockford base32 (no I/L/O/U) keeps them unambiguous when read aloud or typed.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export type IdPrefix = 'USR' | 'CRT' | 'BOX' | 'CNT' | 'INV' | 'MOD' | 'BAD' | 'RPT' | 'TOP' | 'ORD' | 'PAY';

export function publicId(prefix: IdPrefix, length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${prefix}-${out}`;
}
