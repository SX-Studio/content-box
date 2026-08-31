import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentAccount, hasRole } from '@/lib/authz';
import { STEPUP_COOKIE, STEPUP_TTL_SECONDS, signStepUp, verifyStepUp } from '@/lib/stepup';
import { appOrigin } from '@/lib/webauthn';
import type { Account } from '@/lib/accounts';

// Cookie side of the step-up (kept out of lib/stepup so those stay pure/testable).
export async function setStepUpCookie(sub: string) {
  const store = await cookies();
  store.set(STEPUP_COOKIE, signStepUp(sub), {
    httpOnly: true,
    secure: appOrigin().startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: STEPUP_TTL_SECONDS,
  });
}

export async function hasValidStepUp(sub: string): Promise<boolean> {
  const store = await cookies();
  return verifyStepUp(store.get(STEPUP_COOKIE)?.value, sub);
}

// Is this account allowed into the admin backend at all (operator or moderator)?
export async function isAdminAccount(account: Account): Promise<boolean> {
  return (await hasRole(account.id, 'platform_operator')) || (await hasRole(account.id, 'moderator'));
}

// Gate for admin server pages: must be signed in, be an operator/moderator, AND have
// a fresh fingerprint step-up. Non-admins are sent home (no hint the area exists);
// admins without step-up go unlock with their fingerprint.
export async function requireAdminStepUp(): Promise<Account> {
  const account = await currentAccount();
  if (!account) redirect('/login');
  if (!(await isAdminAccount(account))) redirect('/app');
  if (!(await hasValidStepUp(account.id))) redirect('/admin/unlock');
  return account;
}

// Role-only gate (no fingerprint step-up): signed in + operator/moderator. Used for the
// moderation console so operators can enter directly — including on a desktop with no
// biometric authenticator. The sensitive admin backend still uses requireAdminStepUp.
export async function requireAdminRole(): Promise<Account> {
  const account = await currentAccount();
  if (!account) redirect('/login?next=/moderation');
  if (!(await isAdminAccount(account))) redirect('/app');
  return account;
}
