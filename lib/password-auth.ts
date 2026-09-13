import 'server-only';
import { admin } from '@/lib/supabase/admin';
import { hashPassword, verifyPassword } from '@/lib/password';
import { findAccountByPhoneHash, findAccountByEmailHash, type Account } from '@/lib/accounts';
import type { LoginIdentifier } from '@/lib/auth/channel';

// Online-guessing budget. Generous enough not to lock out a person mistyping, tight
// enough that guessing one account is hopeless; the window resets on any success.
export const MAX_FAILED_ATTEMPTS = 8;
export const LOCK_MINUTES = 15;

export type PasswordLoginResult =
  | { ok: true; account: Account }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'locked'; retryAfterSeconds: number };

// Timing ballast for the "no such account" path. Without it, a missing account returns
// measurably faster than a wrong password, which turns the login form into an oracle
// for which phone numbers are registered — exactly what this product must not leak.
let dummyHash: string | null = null;
async function dummyWork(plain: string): Promise<void> {
  if (!dummyHash) dummyHash = await hashPassword('password-not-set-placeholder');
  await verifyPassword(plain, dummyHash);
}

export async function setPassword(accountId: string, plain: string): Promise<void> {
  const password_hash = await hashPassword(plain);
  const { error } = await admin()
    .from('account')
    .update({
      password_hash,
      password_set_at: new Date().toISOString(),
      password_failed_attempts: 0,
      password_locked_until: null,
    })
    .eq('id', accountId);
  if (error) throw new Error(`Could not save password: ${error.message}`);
}

export async function clearPassword(accountId: string): Promise<void> {
  const { error } = await admin()
    .from('account')
    .update({ password_hash: null, password_set_at: null, password_failed_attempts: 0, password_locked_until: null })
    .eq('id', accountId);
  if (error) throw new Error(`Could not remove password: ${error.message}`);
}

export async function hasPassword(accountId: string): Promise<boolean> {
  const { data } = await admin().from('account').select('password_hash').eq('id', accountId).maybeSingle();
  return Boolean((data as { password_hash: string | null } | null)?.password_hash);
}

// Verify a password against the account behind an identifier. Every failure path
// returns the same `invalid` reason so the caller cannot distinguish "no account",
// "no password set" and "wrong password" — only the lockout is reported distinctly,
// because a caller who IS the account owner needs to know to wait.
export async function attemptPasswordLogin(id: LoginIdentifier, plain: string): Promise<PasswordLoginResult> {
  const account = id.channel === 'email'
    ? await findAccountByEmailHash(id.hash)
    : await findAccountByPhoneHash(id.hash);

  if (!account || account.status !== 'active') {
    await dummyWork(plain);
    return { ok: false, reason: 'invalid' };
  }

  const { data } = await admin()
    .from('account')
    .select('password_hash, password_failed_attempts, password_locked_until')
    .eq('id', account.id)
    .maybeSingle();
  const row = data as {
    password_hash: string | null;
    password_failed_attempts: number | null;
    password_locked_until: string | null;
  } | null;

  if (row?.password_locked_until) {
    const until = new Date(row.password_locked_until).getTime();
    const now = Date.now();
    if (until > now) {
      return { ok: false, reason: 'locked', retryAfterSeconds: Math.ceil((until - now) / 1000) };
    }
  }

  if (!row?.password_hash) {
    await dummyWork(plain);
    return { ok: false, reason: 'invalid' };
  }

  if (await verifyPassword(plain, row.password_hash)) {
    if ((row.password_failed_attempts ?? 0) > 0 || row.password_locked_until) {
      await admin()
        .from('account')
        .update({ password_failed_attempts: 0, password_locked_until: null })
        .eq('id', account.id);
    }
    return { ok: true, account };
  }

  const attempts = (row.password_failed_attempts ?? 0) + 1;
  const locked = attempts >= MAX_FAILED_ATTEMPTS;
  await admin()
    .from('account')
    .update({
      password_failed_attempts: locked ? 0 : attempts,
      password_locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
    })
    .eq('id', account.id);

  if (locked) return { ok: false, reason: 'locked', retryAfterSeconds: LOCK_MINUTES * 60 };
  return { ok: false, reason: 'invalid' };
}
