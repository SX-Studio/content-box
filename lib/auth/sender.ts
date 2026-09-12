import 'server-only';
import type { OtpSender } from './otp-adapter';
import { stubSender } from './otp-stub';
import { twilioSender } from './otp-twilio';
import { birdSender } from './otp-bird';
import { env } from '@/lib/env';

// Resolves the active sender from OTP_SENDER ('stub' | 'twilio' | 'bird'). Both real
// senders fall back to the stub when their env vars are missing, so selecting either
// is always safe. Bird is the preferred provider; Twilio is kept as a fallback.
export function getSender(): OtpSender {
  switch (env.otpSender()) {
    case 'bird':
      return birdSender;
    case 'twilio':
      return twilioSender;
    case 'stub':
    default:
      return stubSender;
  }
}
