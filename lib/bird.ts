import 'server-only';
import { env } from '@/lib/env';

// Bird SMS transport (platform.bird.com v1). Verified against
// bird.com/docs/guides/sms/sending-sms:
//   POST https://{region}.platform.bird.com/v1/sms/messages
//   Authorization: Bearer bk_{region}_…
//   { to, from, text, category }  →  202 Accepted
// One shared transport so the OTP sender and notification SMS can never drift
// apart. Never logs the recipient or the text.

export type SmsCategory = 'authentication' | 'transactional' | 'service' | 'marketing';

export type BirdSendResult = { ok: true } | { ok: false; status: number; detail: string };

export function birdMessagesUrl(region: string): string {
  return `https://${region}.platform.bird.com/v1/sms/messages`;
}

export function birdConfigured(): boolean {
  return env.bird() !== null;
}

export async function birdSendSms(toE164: string, text: string, category: SmsCategory): Promise<BirdSendResult> {
  const cfg = env.bird();
  if (!cfg) return { ok: false, status: 0, detail: 'not configured' };

  const res = await fetch(birdMessagesUrl(cfg.region), {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: toE164, from: cfg.from, text, category }),
  });
  if (res.ok) return { ok: true };

  // Bird returns a JSON error body; surface a code/message if present so the log line
  // names the fix. Tolerates either a top-level or a nested `error` object, and a
  // non-JSON body. Never includes the phone or the text.
  let detail = '';
  try {
    const j = (await res.json()) as { code?: unknown; message?: unknown; error?: { code?: unknown; message?: unknown } };
    const src = j.error ?? j;
    detail = `${src.code ?? ''} ${src.message ?? ''}`.trim();
  } catch {
    /* non-JSON error body */
  }
  return { ok: false, status: res.status, detail };
}
