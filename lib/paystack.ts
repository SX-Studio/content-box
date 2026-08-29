import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/lib/env';

// Paystack integration for M-Pesa (Kenya) token purchases. Mirrors the Verotel flow:
// initiate a charge (STK push to the buyer's phone) → the buyer approves with their
// M-Pesa PIN → Paystack calls our webhook → we credit tokens idempotently.
// Flutterwave is a drop-in alternative (same shape: initiate + signed webhook).

const API = 'https://api.paystack.co';

export function paystackConfig(): { configured: boolean; secret: string } {
  const c = env.paystack();
  return c ? { configured: true, secret: c.secret } : { configured: false, secret: '' };
}

// --- pure helpers (unit-testable) ---

// Paystack signs webhooks as HMAC-SHA512 of the raw body with the secret key.
export function signPaystack(rawBody: string, secret: string): string {
  return createHmac('sha512', secret).update(rawBody).digest('hex');
}

export function verifyPaystackSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signPaystack(rawBody, secret));
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

// A package's EUR-cent price → the KES amount to charge, in Paystack subunits (KES×100).
export function eurCentsToKesSubunits(eurCents: number, kesPerEur: number): number {
  return Math.round((eurCents / 100) * kesPerEur * 100);
}

// --- network ---

// Start an M-Pesa mobile-money charge. Paystack sends an STK push; the final result
// arrives via the webhook. `reference` must be unique (we use the token_order id).
export async function initiateMpesaCharge(opts: {
  secret: string;
  email: string;
  amountSubunits: number;
  phoneE164: string;
  reference: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; status?: string; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API}/charge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: opts.email,
        amount: opts.amountSubunits,
        currency: 'KES',
        mobile_money: { phone: opts.phoneE164, provider: 'mpesa' },
        reference: opts.reference,
        metadata: opts.metadata ?? {},
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: { status?: string; display_text?: string; message?: string } };
    if (!res.ok || j.status === false) return { ok: false, error: j.message || 'Charge could not be started' };
    return { ok: true, status: j.data?.status, message: j.data?.display_text || j.data?.message };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
