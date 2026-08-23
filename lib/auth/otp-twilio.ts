import 'server-only';
import type { OtpSender } from './otp-adapter';
import { stubSender } from './otp-stub';
import { env } from '@/lib/env';

const MESSAGES_BASE = 'https://api.twilio.com/2010-04-01/Accounts';

// Real OTP delivery over Twilio's REST API. Uses a Standard API Key
// (SK sid + secret) for basic auth so a leaked key can be revoked without
// touching the account Auth Token. No SDK dependency — a single fetch keeps the
// serverless bundle small.
//
// Safe fallback: if Twilio is not (fully) configured, this delegates to the stub
// sender (logs the code) so the auth flow keeps working in dev / before the env
// vars are set. A configured-but-rejected send throws so the failure is visible.
export const twilioSender: OtpSender = {
  async send(phoneE164, code) {
    const cfg = env.twilio();
    if (!cfg) {
      // eslint-disable-next-line no-console
      console.warn('[OTP:twilio] not configured — falling back to stub');
      return stubSender.send(phoneE164, code);
    }

    const form = new URLSearchParams();
    form.set('To', phoneE164);
    if (cfg.messagingServiceSid) form.set('MessagingServiceSid', cfg.messagingServiceSid);
    else form.set('From', cfg.fromNumber);
    form.set('Body', `Your Content Box code is ${code}. It expires in a few minutes. Do not share it.`);

    const auth = Buffer.from(`${cfg.apiKeySid}:${cfg.apiKeySecret}`).toString('base64');
    const res = await fetch(`${MESSAGES_BASE}/${cfg.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (!res.ok) {
      // Twilio returns a JSON error body (message/code) — never log the phone or code.
      let detail = '';
      try {
        const j = (await res.json()) as { message?: string; code?: number };
        detail = `${j.code ?? ''} ${j.message ?? ''}`.trim();
      } catch {
        /* non-JSON error body */
      }
      throw new Error(`Twilio send failed (${res.status})${detail ? `: ${detail}` : ''}`);
    }
  },
};
