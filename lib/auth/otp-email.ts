import 'server-only';
import { sendEmailChecked, emailConfigured } from '@/lib/email';
import { env } from '@/lib/env';

// Email OTP delivery over Resend. Same contract as the Twilio sender: a
// configured-but-rejected send throws so the failure is visible.
//
// The fallback is deliberately STRICTER than SMS. The SMS stub logs codes whenever
// OTP_SENDER=stub; email is an independent channel, so on a production site running
// real SMS but with no Resend configured, silently logging email codes would let
// anyone with log access sign in as anyone. So: no Resend + explicit stub mode →
// log the code (address masked); no Resend otherwise → refuse email sign-in.

export class EmailLoginUnavailable extends Error {
  constructor() {
    super('Email sign-in is not available yet. Please use your phone number.');
    this.name = 'EmailLoginUnavailable';
  }
}

export function emailLoginAvailable(): boolean {
  return emailConfigured() || env.otpSender() === 'stub';
}

// An email is as private as a phone here — never log the whole address, even in dev.
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  return `${local[0]}${'*'.repeat(Math.max(2, local.length - 1))}${domain}`;
}

export async function sendEmailOtp(email: string, code: string): Promise<void> {
  if (!emailConfigured()) {
    if (env.otpSender() !== 'stub') throw new EmailLoginUnavailable();
    // eslint-disable-next-line no-console
    console.log(`[OTP:email-stub] ${maskEmail(email)} -> ${code}`);
    return;
  }
  const r = await sendEmailChecked(
    email,
    'Your Content Box sign-in code',
    `Your Content Box code is ${code}. It expires in a few minutes. Do not share it.`,
  );
  // Carry Resend's own code/message into the thrown error. A bare status is not enough
  // to tell an unverified EMAIL_FROM domain (403 validation_error) apart from a bad key,
  // and that distinction is the whole diagnosis.
  if (!r.ok) throw new Error(`Email send failed (${r.status})${r.detail ? `: ${r.detail}` : ''}`);
}
