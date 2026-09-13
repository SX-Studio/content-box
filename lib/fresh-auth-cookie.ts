import 'server-only';
import { cookies } from 'next/headers';
import { FRESH_AUTH_COOKIE, FRESH_AUTH_TTL_SECONDS, signFreshAuth, verifyFreshAuth } from '@/lib/fresh-auth';

// Cookie side, kept out of lib/fresh-auth so the sign/verify stay pure and testable —
// same split as session / session-cookie and stepup / admin-stepup.
export async function setFreshAuthCookie(sub: string) {
  const store = await cookies();
  store.set(FRESH_AUTH_COOKIE, signFreshAuth(sub), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: FRESH_AUTH_TTL_SECONDS,
  });
}

export async function clearFreshAuthCookie() {
  const store = await cookies();
  store.set(FRESH_AUTH_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function hasFreshAuth(sub: string): Promise<boolean> {
  const store = await cookies();
  return verifyFreshAuth(store.get(FRESH_AUTH_COOKIE)?.value, sub);
}
