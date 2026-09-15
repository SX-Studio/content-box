import 'server-only';
import { env } from '@/lib/env';
import { birdSendSms } from '@/lib/bird';

const MESSAGES_BASE = 'https://api.twilio.com/2010-04-01/Accounts';

// Notification SMS follows the OTP provider: when OTP_SENDER selects Bird, notifications
// go through Bird too (so a Twilio problem can't silently keep affecting payout/identity
// texts). Any other value keeps the original Twilio path exactly as before.
//
// 'bird-verify' counts as Bird here even though its OTP codes go via the Verify API:
// Verify only ever sends a verification code, so arbitrary notification text — payout
// decisions, identity outcomes, box invites — must still go over the plain SMS send.
// Without this, selecting bird-verify silently routed every notification to the
// unconfigured Twilio path, where it returned false and vanished.
function useBird(): boolean {
  const s = env.otpSender();
  return s === 'bird' || s === 'bird-verify';
}

export function smsConfigured(): boolean {
  return useBird() ? env.bird() !== null : env.twilio() !== null;
}

export type SmsSendResult = { ok: true } | { ok: false; status: number; detail: string };

// Detailed send. Mirrors sendEmailChecked: callers that must report WHY a send failed
// get the provider's own words. birdPost already builds `detail` from Bird's
// { code, message } envelope — dropping it on the floor is what left invite delivery
// undiagnosable. Never logs or returns the recipient or the body.
export async function sendSmsChecked(toE164: string, body: string): Promise<SmsSendResult> {
  if (useBird()) {
    try {
      const r = await birdSendSms(toE164, body, 'transactional');
      if (!r.ok) {
        // eslint-disable-next-line no-console
        console.warn(`[sms] bird send failed (${r.status})${r.detail ? `: ${r.detail}` : ''}`);
        return { ok: false, status: r.status, detail: r.detail || `Bird refused the send (${r.status})` };
      }
      return { ok: true };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[sms] bird send error');
      return { ok: false, status: 0, detail: (e as Error).message || 'send error' };
    }
  }

  const cfg = env.twilio();
  if (!cfg) return { ok: false, status: 0, detail: 'Twilio is not configured' };

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
      let detail = '';
      try {
        const j = (await res.json()) as { code?: unknown; message?: unknown };
        detail = `${j.code ?? ''} ${j.message ?? ''}`.trim();
      } catch { /* non-JSON body */ }
      // eslint-disable-next-line no-console
      console.warn(`[sms] twilio send failed (${res.status})${detail ? `: ${detail}` : ''}`);
      return { ok: false, status: res.status, detail: detail || `Twilio refused the send (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[sms] twilio send error');
    return { ok: false, status: 0, detail: (e as Error).message || 'send error' };
  }
}

// Best-effort transactional SMS. Boolean contract kept for fire-and-forget callers
// (payouts, identity). Use sendSmsChecked when the caller must report the reason.
export async function sendSms(toE164: string, body: string): Promise<boolean> {
  return (await sendSmsChecked(toE164, body)).ok;
}
