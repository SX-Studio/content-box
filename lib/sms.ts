import 'server-only';
import { env } from '@/lib/env';
import { birdSendSms } from '@/lib/bird';

const MESSAGES_BASE = 'https://api.twilio.com/2010-04-01/Accounts';

// Notification SMS follows the OTP provider: when OTP_SENDER=bird, notifications go
// through Bird too (so a Twilio problem can't silently keep affecting payout/identity
// texts). Any other value keeps the original Twilio path exactly as before.
function useBird(): boolean {
  return env.otpSender() === 'bird';
}

export function smsConfigured(): boolean {
  return useBird() ? env.bird() !== null : env.twilio() !== null;
}

// Best-effort transactional SMS. Returns false instead of throwing when unconfigured
// or on error, so callers can treat notifications as fire-and-forget. Never logs the
// recipient or the body.
export async function sendSms(toE164: string, body: string): Promise<boolean> {
  if (useBird()) {
    try {
      const r = await birdSendSms(toE164, body, 'transactional');
      if (!r.ok) {
        // eslint-disable-next-line no-console
        console.warn(`[sms] send failed (${r.status})`);
        return false;
      }
      return true;
    } catch {
      // eslint-disable-next-line no-console
      console.warn('[sms] send error');
      return false;
    }
  }

  const cfg = env.twilio();
  if (!cfg) return false;

  const form = new URLSearchParams();
  form.set('To', toE164);
  if (cfg.messagingServiceSid) form.set('MessagingServiceSid', cfg.messagingServiceSid);
  else form.set('From', cfg.fromNumber);
  form.set('Body', body);

  const auth = Buffer.from(`${cfg.apiKeySid}:${cfg.apiKeySecret}`).toString('base64');
  try {
    const res = await fetch(`${MESSAGES_BASE}/${cfg.accountSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[sms] send failed (${res.status})`);
      return false;
    }
    return true;
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[sms] send error');
    return false;
  }
}
