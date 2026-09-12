import 'server-only';
import { toE164, phoneHash, normalizeLoginEmail, emailHash } from '@/lib/crypto';

export type LoginChannel = 'sms' | 'email';

export type LoginIdentifier = {
  channel: LoginChannel;
  identifier: string; // E.164 phone or normalised email (plaintext — server-side only, never persisted as-is)
  hash: string;       // keyed HMAC; the only form that touches the database
};

// The one place that decides which login channel a request is for. Exactly one of
// { phone, email } must be present; each normaliser throws its own user-facing message.
export function resolveLoginIdentifier(body: unknown): LoginIdentifier {
  const b = (body ?? {}) as { phone?: unknown; email?: unknown };
  const phone = String(b.phone ?? '').trim();
  const email = String(b.email ?? '').trim();

  if (phone && email) throw new Error('Enter a phone number or an email address, not both');

  if (email) {
    const normalised = normalizeLoginEmail(email);
    return { channel: 'email', identifier: normalised, hash: emailHash(normalised) };
  }

  const e164 = toE164(phone);
  return { channel: 'sms', identifier: e164, hash: phoneHash(e164) };
}
