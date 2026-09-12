import 'server-only';
import { env } from '@/lib/env';

// Bird SMS transport (platform.bird.com v1). Verified against
// bird.com/docs/api/reference/create-sms-message:
//   POST https://{region}.platform.bird.com/v1/sms/messages
//   Authorization: Bearer bk_{region}_…
//   text:     { to, from, text, category }
//   template: { to, template: { slug, language?, parameters } }
//   → 202 Accepted
// `text` and `template` are mutually exclusive; a template send carries no
// from/category because the stored template selects sender and category itself.
//
// One shared transport so the OTP sender and notification SMS can never drift
// apart. Never logs the recipient, the text, or the template parameters.

export type SmsCategory = 'authentication' | 'transactional' | 'service' | 'marketing';

export type BirdSendResult = { ok: true } | { ok: false; status: number; detail: string };

export function birdMessagesUrl(region: string): string {
  return `https://${region}.platform.bird.com/v1/sms/messages`;
}

export function birdConfigured(): boolean {
  return env.bird() !== null;
}

// The single place that talks to Bird. Both send shapes funnel through here so
// auth, error parsing and the no-PII-in-logs rule are written exactly once.
async function birdPost(body: Record<string, unknown>): Promise<BirdSendResult> {
  const cfg = env.bird();
  if (!cfg) return { ok: false, status: 0, detail: 'not configured' };

  const res = await fetch(birdMessagesUrl(cfg.region), {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };

  // Bird returns a JSON error envelope { type, code, message, request_id }; surface
  // code/message so the log line names the fix. Tolerates a nested `error` object and
  // a non-JSON body. Never includes the phone, the text or template parameters.
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

export async function birdSendSms(toE164: string, text: string, category: SmsCategory): Promise<BirdSendResult> {
  const cfg = env.bird();
  if (!cfg) return { ok: false, status: 0, detail: 'not configured' };
  return birdPost({ to: toE164, from: cfg.from, text, category });
}

// Send a stored Bird template (e.g. the built-in `bird_otp_verification`). Preferred
// for OTP where a pre-registered template improves deliverability; `parameters` are
// the template's variables keyed by name.
export async function birdSendTemplate(
  toE164: string,
  slug: string,
  parameters: Record<string, string>,
  language?: string,
): Promise<BirdSendResult> {
  const template: Record<string, unknown> = { slug, parameters };
  if (language) template.language = language;
  return birdPost({ to: toE164, template });
}
