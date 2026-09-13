import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/lib/env';

// Short-lived proof that THIS account authenticated from scratch (OTP) just now —
// distinct from the 30-day session, which only proves they did so at some point.
//
// Deliberately NOT lib/stepup.ts. That cookie is the admin fingerprint proof and
// gates the admin backend via requireAdminStepUp(); minting it on an OTP sign-in
// would let an operator into the admin area by SMS alone, without their fingerprint.
// Same construction, separate namespace, separate cookie — a token from one family
// can never be replayed as another.
export const FRESH_AUTH_COOKIE = 'cb_freshauth';
export const FRESH_AUTH_TTL_SECONDS = 15 * 60; // 15 minutes

type Payload = { sub: string; exp: number };

function sign(data: string): string {
  return createHmac('sha256', env.sessionSecret()).update(`freshauth:${data}`).digest('base64url');
}

export function signFreshAuth(sub: string, ttlSeconds = FRESH_AUTH_TTL_SECONDS): string {
  const payload: Payload = { sub, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyFreshAuth(token: string | undefined | null, expectedSub: string): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as Payload;
    if (!p.sub || !p.exp || p.exp < Math.floor(Date.now() / 1000)) return false;
    return p.sub === expectedSub;
  } catch {
    return false;
  }
}
