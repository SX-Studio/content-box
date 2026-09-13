import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number },
) => Promise<Buffer>;

// scrypt, not bcrypt/argon2: it is in Node's standard library, so the serverless
// bundle gains nothing and there is no native build to go wrong — the same reasoning
// that kept the Twilio/Bird/Resend transports on plain fetch.
//
// N=2^14 with r=8 needs ~16 MB per hash (128*N*r), comfortably under Node's 32 MB
// default maxmem, and costs enough to make offline guessing expensive.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

export const MIN_PASSWORD_LENGTH = 10;

// The stored form is self-describing — the parameters travel with the hash, so N/r/p
// can be raised later without invalidating everyone's existing password.
function encode(salt: Buffer, hash: Buffer): string {
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

type Parsed = { N: number; r: number; p: number; salt: Buffer; hash: Buffer };

function parse(stored: string): Parsed | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [, n, r, p, saltB64, hashB64] = parts;
  const nN = Number(n), nR = Number(r), nP = Number(p);
  if (!Number.isInteger(nN) || !Number.isInteger(nR) || !Number.isInteger(nP)) return null;
  if (nN < 1024 || nN > 1 << 20 || nR < 1 || nR > 32 || nP < 1 || nP > 16) return null;
  try {
    const salt = Buffer.from(saltB64, 'base64');
    const hash = Buffer.from(hashB64, 'base64');
    if (salt.length === 0 || hash.length === 0) return null;
    return { N: nN, r: nR, p: nP, salt, hash };
  } catch {
    return null;
  }
}

export class WeakPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeakPasswordError';
  }
}

// Length is the property that actually resists guessing, so it carries the rule rather
// than a character-class checklist (which pushes people towards P@ssw0rd1). The upper
// bound exists because scrypt cost is paid by our server, not the caller — an
// unbounded password is a cheap way to make us do unbounded work.
export function validatePassword(raw: unknown): string {
  const pw = typeof raw === 'string' ? raw : '';
  if (pw.length < MIN_PASSWORD_LENGTH) {
    throw new WeakPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (pw.length > 200) throw new WeakPasswordError('Password must be at most 200 characters');
  if (pw.trim().length === 0) throw new WeakPasswordError('Password cannot be only spaces');
  if (new Set(pw).size < 4) throw new WeakPasswordError('Password is too repetitive');
  return pw;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(plain, salt, KEYLEN, { N, r: R, p: P });
  return encode(salt, hash);
}

// Constant-time compare, and a uniform false for every malformed/absent stored value —
// a caller must not be able to tell "no password set" from "wrong password" by timing
// or by error shape. Callers are responsible for doing the same dummy work when the
// account itself doesn't exist.
export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parsed = parse(stored);
  if (!parsed) return false;
  let candidate: Buffer;
  try {
    candidate = await scrypt(plain, parsed.salt, parsed.hash.length, { N: parsed.N, r: parsed.r, p: parsed.p });
  } catch {
    return false;
  }
  if (candidate.length !== parsed.hash.length) return false;
  return timingSafeEqual(candidate, parsed.hash);
}
