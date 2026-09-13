import 'server-only';
import { env } from '@/lib/env';

// Bird Verify — the managed OTP product, NOT the raw /v1/sms/messages send in
// lib/bird.ts. Bird generates, delivers and checks the code; we only ask it to start a
// verification and later whether a submitted code matched.
//
// Verified against bird.com/docs/guides/verify/sending-verifications:
//   POST https://{eu1|us1}.platform.bird.com/v1/verify/verifications
//        { "to": { "phone_number": "+32…" } }  |  { "to": { "email": "…" } }
//     -> { id: "vrf_…", status: "pending" | "verified" | "failed" | "expired", … }
//   POST …/v1/verify/verifications/check
//        { "to": {…}, "code": "123456" }
//     -> { success: boolean, reason: string|null, attempts_remaining: number, … }
//
// Why it exists alongside lib/bird.ts: Verify uses Bird's shared senders, which need
// no sender-ID registration per country — the gate that blocks a plain SMS send in
// markets that pre-register alphanumeric senders.

export type VerifyTarget = { phone_number: string } | { email: string };

export type VerifyStartResult =
  | { ok: true; id: string; status: string }
  | { ok: false; status: number; detail: string };

export type VerifyCheckResult =
  | { ok: true; success: boolean; reason: string | null; attemptsRemaining: number | null }
  | { ok: false; status: number; detail: string };

function baseUrl(region: 'eu1' | 'us1'): string {
  return `https://${region}.platform.bird.com/v1/verify/verifications`;
}

// One place for auth and error parsing, mirroring lib/bird.ts. Never logs or returns
// the recipient or the code.
async function post(path: string, body: unknown): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; status: number; detail: string }> {
  const cfg = env.birdVerify();
  if (!cfg) return { ok: false, status: 0, detail: 'not configured' };

  let res: Response;
  try {
    res = await fetch(`${baseUrl(cfg.region)}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, detail: 'network error' };
  }

  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    // non-JSON body
  }

  if (!res.ok) {
    const src = (json.error as Record<string, unknown> | undefined) ?? json;
    const detail = `${src?.code ?? src?.name ?? ''} ${src?.message ?? ''}`.trim();
    return { ok: false, status: res.status, detail };
  }
  return { ok: true, json };
}

export async function birdVerifyStart(to: VerifyTarget): Promise<VerifyStartResult> {
  const r = await post('', { to });
  if (!r.ok) return r;
  return {
    ok: true,
    id: String(r.json.id ?? ''),
    status: String(r.json.status ?? 'pending'),
  };
}

export async function birdVerifyCheck(to: VerifyTarget, code: string): Promise<VerifyCheckResult> {
  const r = await post('/check', { to, code });
  if (!r.ok) return r;
  const attempts = r.json.attempts_remaining;
  return {
    ok: true,
    success: r.json.success === true,
    reason: typeof r.json.reason === 'string' ? r.json.reason : null,
    attemptsRemaining: typeof attempts === 'number' ? attempts : null,
  };
}
