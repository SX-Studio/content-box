import 'server-only';
import type { OtpSender } from './otp-adapter';
import { stubSender } from './otp-stub';
import { twilioSender } from './otp-twilio';
import { env } from '@/lib/env';

// Resolves the active sender from OTP_SENDER. The Twilio sender itself falls back
// to the stub when its env vars are missing, so 'twilio' is always safe to select.
export function getSender(): OtpSender {
  switch (env.otpSender()) {
    case 'twilio':
      return twilioSender;
    case 'stub':
    default:
      return stubSender;
  }
}
