import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/lib/env';

// Crypto token purchases via NOWPayments (adult-friendly, multi-coin hosted
// checkout + IPN webhook). Self-contained config like lib/verotel.ts: returns
// configured:false until both the API key and IPN secret are set, so the route
// can respond { configured:false } and the client keeps the dev top-up fallback.
const API = 'https://api.nowpayments.io/v1';

export function nowpaymentsConfig() {
  const apiKey = (process.env.NOWPAYMENTS_API_KEY ?? '').trim();
  const ipnSecret = (process.env.NOWPAYMENTS_IPN_SECRET ?? '').trim();
  return { configured: Boolean(apiKey && ipnSecret), apiKey, ipnSecret };
}

// Every URL handed to NOWPayments — the IPN callback above all — is built from
// APP_ORIGIN, which falls back to http://localhost:3000 when unset. An invoice
// created with that callback takes the buyer's crypto and then posts the "paid"
// notification into the void: money moves, the wallet is never credited, and
// nothing anywhere reports an error. Refuse to create the invoice instead.
export function publicOrigin(): string | null {
  const o = env.appOrigin().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(o)) return null;
  if (/^https:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(o)) return null;
  return o;
}

// Create a hosted invoice; the buyer picks the coin on NOWPayments' page and is
// returned to /app afterwards. Wallet credit happens later via the IPN webhook.
export type InvoiceResult =
  | { ok: true; url: string; id: string }
  | { ok: false; reason: string };

export async function createInvoice(opts: {
  apiKey: string;
  priceEur: number;
  orderId: string;
  description: string; // ASCII, slash-free (keeps IPN signature parity simple)
}): Promise<InvoiceResult> {
  const origin = publicOrigin();
  if (!origin) {
    return { ok: false, reason: `APP_ORIGIN is not a public https origin (got "${env.appOrigin()}") — NOWPayments could not reach the IPN callback, so a paid invoice would never credit the wallet` };
  }
  const res = await fetch(`${API}/invoice`, {
    method: 'POST',
    headers: { 'x-api-key': opts.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price_amount: opts.priceEur,
      price_currency: 'eur',
      order_id: opts.orderId,
      order_description: opts.description,
      ipn_callback_url: `${origin}/api/wallet/crypto/webhook`,
      success_url: `${origin}/app?status=success`,
      cancel_url: `${origin}/app?status=cancel`,
    }),
  });
  // Carry NOWPayments' own words out. Swallowing the provider's error is exactly
  // what cost two debugging rounds on the Bird SMS integration — the reason existed
  // and was simply unreachable. Nothing here echoes the API key.
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, reason: `NOWPayments invoice failed (${res.status})${detail ? `: ${detail.slice(0, 300)}` : ''}` };
  }
  const j = (await res.json().catch(() => null)) as { id?: string | number; invoice_url?: string } | null;
  if (!j?.invoice_url) return { ok: false, reason: 'NOWPayments returned no invoice_url' };
  return { ok: true, url: j.invoice_url, id: String(j.id ?? '') };
}

// IPN signature: HMAC-SHA512 of the JSON body with keys sorted alphabetically,
// keyed with the IPN secret, compared to the x-nowpayments-sig header.
export function verifyIpn(body: unknown, signature: string, secret: string): boolean {
  if (!signature) return false;
  const payload = JSON.stringify(sortDeep(body));
  const digest = createHmac('sha512', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature.toLowerCase()));
  } catch {
    return false;
  }
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortDeep(obj[k]);
    return out;
  }
  return v;
}
