import { NextRequest, NextResponse } from 'next/server';
import { currentAccount } from '@/lib/authz';
import { hasFreshAuth } from '@/lib/fresh-auth-cookie';
import { validatePassword, WeakPasswordError, verifyPassword } from '@/lib/password';
import { setPassword, clearPassword } from '@/lib/password-auth';
import { admin } from '@/lib/supabase/admin';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Set, change or remove the optional sign-in password for the signed-in account.
//
// Authorisation is deliberately stricter than "has a session": the session lasts 30
// days, so on its own it would let anyone holding a stolen cookie mint a permanent
// credential. Either a fresh OTP (the cb_freshauth proof, 15 min) or the CURRENT
// password is required — the same bar a bank uses for changing a login factor.
// Lets the settings page render the right thing without guessing: whether a password
// exists, and whether this session still counts as freshly authenticated.
export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Sign in first' }, { status: 401 });
  const { data } = await admin().from('account').select('password_hash').eq('id', account.id).maybeSingle();
  return NextResponse.json({
    ok: true,
    hasPassword: Boolean((data as { password_hash: string | null } | null)?.password_hash),
    freshAuth: await hasFreshAuth(account.id),
  });
}

export async function POST(req: NextRequest) {
 try {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Sign in first' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
  const b = (body ?? {}) as { password?: unknown; currentPassword?: unknown; remove?: unknown };

  const { data } = await admin().from('account').select('password_hash').eq('id', account.id).maybeSingle();
  const existing = (data as { password_hash: string | null } | null)?.password_hash ?? null;

  const fresh = await hasFreshAuth(account.id);
  const currentOk = existing
    ? await verifyPassword(typeof b.currentPassword === 'string' ? b.currentPassword : '', existing)
    : false;

  if (!fresh && !currentOk) {
    return NextResponse.json({
      ok: false,
      error: existing
        ? 'Enter your current password, or sign in again with a code to change it.'
        : 'Sign in again with a code to set a password.',
      needsFreshAuth: true,
    }, { status: 403 });
  }

  if (b.remove === true) {
    await clearPassword(account.id);
    await writeAudit({ actorId: account.id, action: 'password.removed', targetType: 'account', targetId: account.public_id });
    return NextResponse.json({ ok: true, hasPassword: false });
  }

  let password: string;
  try {
    password = validatePassword(b.password);
  } catch (e) {
    if (e instanceof WeakPasswordError) return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    throw e;
  }

  await setPassword(account.id, password);
  await writeAudit({
    actorId: account.id,
    action: existing ? 'password.changed' : 'password.set',
    targetType: 'account',
    targetId: account.public_id,
  });
  return NextResponse.json({ ok: true, hasPassword: true });
 } catch (e) {
  console.error('[password/set] unexpected error:', e);
  return NextResponse.json({ ok: false, error: 'Could not save your password. Please try again.' }, { status: 500 });
 }
}
