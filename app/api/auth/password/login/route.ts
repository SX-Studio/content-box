import { NextRequest, NextResponse } from 'next/server';
import { resolveLoginIdentifier, type LoginIdentifier } from '@/lib/auth/channel';
import { attemptPasswordLogin } from '@/lib/password-auth';
import { setSessionCookie } from '@/lib/session-cookie';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sign in with phone-or-email + password, skipping the SMS/email round trip.
// OTP remains available and is the only route for an account with no password set,
// so this never becomes a way to lock someone out of their own account.
export async function POST(req: NextRequest) {
 try {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const password = String((body as { password?: unknown })?.password ?? '');
  if (!password) return NextResponse.json({ ok: false, error: 'Enter your password' }, { status: 400 });

  let id: LoginIdentifier;
  try {
    id = resolveLoginIdentifier(body);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }

  const result = await attemptPasswordLogin(id, password);

  if (!result.ok && result.reason === 'locked') {
    const mins = Math.ceil(result.retryAfterSeconds / 60);
    return NextResponse.json(
      { ok: false, error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}, or sign in with a code.` },
      { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
    );
  }

  if (!result.ok) {
    // One message for every failure: wrong password, no password set, and no such
    // account are indistinguishable, so this form can't be used to discover which
    // phone numbers are registered.
    return NextResponse.json(
      { ok: false, error: 'Incorrect details, or this account has no password yet. Try signing in with a code.' },
      { status: 401 },
    );
  }

  await setSessionCookie(result.account.id);
  // Note: no fresh-auth cookie here on purpose. A password is a stored credential, not
  // proof of live control of the number, so it must not authorise CHANGING the
  // password — that still needs the current password or a fresh code.
  await writeAudit({
    actorId: result.account.id,
    action: 'account.login',
    targetType: 'account',
    targetId: result.account.public_id,
    metadata: { channel: id.channel, method: 'password' },
  });

  return NextResponse.json({ ok: true, account: { public_id: result.account.public_id } });
 } catch (e) {
  console.error('[password/login] unexpected error:', e);
  return NextResponse.json({ ok: false, error: 'Server error signing in. Please try again later.' }, { status: 500 });
 }
}
