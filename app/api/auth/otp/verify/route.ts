import { NextRequest, NextResponse } from 'next/server';
import { toE164, phoneHash } from '@/lib/crypto';
import { admin } from '@/lib/supabase/admin';
import { otpMatches } from '@/lib/auth/otp';
import { findOrCreateAccount } from '@/lib/accounts';
import { setSessionCookie } from '@/lib/session-cookie';
import { writeAudit } from '@/lib/audit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Verify a code: find the latest active challenge, enforce the attempt cap, match the
// hash in constant time, then create/find the account and open a session.
export async function POST(req: NextRequest) {
 try {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
  const raw = body as { phone?: unknown; code?: unknown };

  const code = String(raw?.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: 'Enter the 6-digit code' }, { status: 400 });
  }
  let e164: string;
  try {
    e164 = toE164(String(raw?.phone ?? ''));
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }

  const hash = phoneHash(e164);
  const { data: challenge } = await admin()
    .from('otp_challenge')
    .select('id, code_hash, attempts')
    .eq('phone_hash', hash)
    .is('consumed_at', null)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge) {
    return NextResponse.json({ ok: false, error: 'Code expired or not found. Request a new one.' }, { status: 400 });
  }

  if (challenge.attempts >= env.otpMaxAttempts()) {
    await admin().from('otp_challenge').update({ consumed_at: new Date().toISOString() }).eq('id', challenge.id);
    return NextResponse.json({ ok: false, error: 'Too many attempts. Request a new code.' }, { status: 429 });
  }

  if (!otpMatches(hash, code, challenge.code_hash)) {
    await admin().from('otp_challenge').update({ attempts: challenge.attempts + 1 }).eq('id', challenge.id);
    return NextResponse.json({ ok: false, error: 'Incorrect code' }, { status: 400 });
  }

  await admin().from('otp_challenge').update({ consumed_at: new Date().toISOString() }).eq('id', challenge.id);

  const { account, isNew } = await findOrCreateAccount(e164);
  await setSessionCookie(account.id);
  await writeAudit({
    actorId: account.id,
    action: isNew ? 'account.registered' : 'account.login',
    targetType: 'account',
    targetId: account.public_id,
  });

  return NextResponse.json({ ok: true, account: { public_id: account.public_id }, isNew });
 } catch (e) {
  // Never let an unexpected throw (missing env var, DB/session failure) return a
  // bodyless 500 the client can't parse. Log the real cause; return JSON.
  console.error('[otp/verify] unexpected error:', e);
  return NextResponse.json({ ok: false, error: 'Server error verifying code. Please try again later.' }, { status: 500 });
 }
}
