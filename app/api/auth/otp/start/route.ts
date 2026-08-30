import { NextRequest, NextResponse } from 'next/server';
import { toE164, phoneHash } from '@/lib/crypto';
import { admin } from '@/lib/supabase/admin';
import { generateOtp, hashOtp } from '@/lib/auth/otp';
import { getSender } from '@/lib/auth/sender';
import { tooManyOtpRequests } from '@/lib/ratelimit';
import { writeAudit } from '@/lib/audit';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Start phone verification: generate a code, store its hash, send via the OTP sender.
// The response never reveals whether an account already exists for the number.
export async function POST(req: NextRequest) {
 try {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  let e164: string;
  try {
    e164 = toE164(String((body as { phone?: unknown })?.phone ?? ''));
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }

  const hash = phoneHash(e164);
  if (await tooManyOtpRequests(hash)) {
    return NextResponse.json({ ok: false, error: 'Too many codes requested. Please wait and try again.' }, { status: 429 });
  }

  const code = generateOtp();
  const { error } = await admin().from('otp_challenge').insert({
    phone_hash: hash,
    code_hash: hashOtp(hash, code),
    expires_at: new Date(Date.now() + env.otpTtlSeconds() * 1000).toISOString(),
    request_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: 'Could not start verification' }, { status: 500 });
  }

  await getSender().send(e164, code);
  await writeAudit({ action: 'otp.started', targetType: 'phone_hash', targetId: hash });
  return NextResponse.json({ ok: true, ttlSeconds: env.otpTtlSeconds() });
 } catch (e) {
  // A thrown error here (e.g. a missing server env var like PHONE_HASH_KEY or the
  // Supabase service-role key) would otherwise return a bodyless 500, which the
  // client can't parse. Log the real cause; return parseable JSON.
  console.error('[otp/start] unexpected error:', e);
  return NextResponse.json({ ok: false, error: 'Server not configured to send codes. Please try again later.' }, { status: 500 });
 }
}
