import 'server-only';
import { env } from '@/lib/env';
import type { LoginIdentifier } from '@/lib/auth/channel';
import type { VerifyTarget } from '@/lib/bird-verify';

// OTP_SENDER=bird-verify delegates code generation and checking to Bird Verify.
// Any other value keeps the original local flow (we generate, hash, store and check
// the code ourselves), so this is a switch, not a replacement.
// Scoped to SMS on purpose. Email OTP stays on Resend: that path already works from
// a verified own-domain sender, whereas Bird's shared Verify sender would rebrand the
// mail as authifly. Verify is here to solve the SMS sender-registration problem, not
// to take over a channel that is already fine.
export function birdVerifyMode(channel: LoginIdentifier['channel']): boolean {
  return channel === 'sms' && env.otpSender() === 'bird-verify' && env.birdVerify() !== null;
}

// Bird addresses the recipient directly, so the plaintext identifier goes over the
// wire exactly as it already does for a plain SMS send. It is never persisted here —
// only the hash reaches our database, unchanged from the local flow.
export function toVerifyTarget(id: LoginIdentifier): VerifyTarget {
  return id.channel === 'email' ? { email: id.identifier } : { phone_number: id.identifier };
}
