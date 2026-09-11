import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { generateOtp, hashOtp } from '@/lib/auth/otp';
import { getSender } from '@/lib/auth/sender';
import { resolveLoginIdentifier, type LoginIdentifier } from '@/lib/auth/channel';
import { sendEmailOtp, emailLoginAvailable, EmailLoginUnavailable } from '@/lib/auth/otp-email';
import { tooManyOtpRequests } from '@/lib/ratelimit';
import { writeAudit } from '@/lib/audit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Start verification for a phone OR an email: generate a code, store its hash, send
// it over the matching channel. The response never reveals whether an account already
// exists for the identifier.
export async function POST(req: NextRequest) {
 try {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  let id: LoginIdentifier;
  try {
    id = resolveLoginIdentifier(body);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }

  // Refuse up front (before writing a challenge or spending rate-limit budget) when
  // email delivery isn't available — see lib/auth/otp-email for why this is strict.
  if (id.channel === 'email' && !emailLoginAvailable()) {
    return NextResponse.json({ ok: false, error: new EmailLoginUnavailable().message }, { status: 503 });
  }

  if (await tooManyOtpRequests(id.hash)) {
    return NextResponse.json({ ok: false, error: 'Too many codes requested. Please wait and try again.' }, { status: 429 });
  }

  const code = generateOtp();
  const { error } = await admin().from('otp_challenge').insert({
    phone_hash: id.hash,
    channel: id.channel,
    code_hash: hashOtp(id.hash, code),
    expires_at: new Date(Date.now() + env.otpTtlSeconds() * 1000).toISOString(),
    request_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: 'Could not start verification' }, { status: 500 });
  }

  try {
    if (id.channel === 'email') await sendEmailOtp(id.identifier, code);
    else await getSender().send(id.identifier, code);
  } catch (e) {
    if (e instanceof EmailLoginUnavailable) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 503 });
    }
    throw e;
  }

  await writeAudit({
    action: 'otp.started',
    targetType: id.channel === 'email' ? 'email_hash' : 'phone_hash',
    targetId: id.hash,
  });
  return NextResponse.json({ ok: true, ttlSeconds: env.otpTtlSeconds(), channel: id.channel });
 } catch (e) {
  // A thrown error here (e.g. a missing server env var like PHONE_HASH_KEY or the
  // Supabase service-role key) would otherwise return a bodyless 500, which the
  // client can't parse. Log the real cause; return parseable JSON.
  console.error('[otp/start] unexpected error:', e);
  return NextResponse.json({ ok: false, error: 'Server not configured to send codes. Please try again later.' }, { status: 500 });
 }
}
