import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'crypto';

const OLD = process.env.APP_ORIGIN;
afterEach(() => {
  process.env.APP_ORIGIN = OLD;
  vi.restoreAllMocks();
  vi.resetModules();
});
beforeEach(() => vi.resetModules());

describe('publicOrigin', () => {
  it('accepts a public https origin and trims the trailing slash', async () => {
    process.env.APP_ORIGIN = 'https://content24market.space/';
    const { publicOrigin } = await import('@/lib/nowpayments');
    expect(publicOrigin()).toBe('https://content24market.space');
  });

  // Each of these would produce an IPN callback NOWPayments cannot reach, which means
  // the buyer's crypto moves and their wallet is never credited.
  it.each([
    ['unset (defaults to localhost)', undefined],
    ['http, not https', 'http://content24market.space'],
    ['localhost', 'https://localhost:3000'],
    ['loopback ip', 'https://127.0.0.1:3000'],
  ])('rejects %s', async (_label, value) => {
    if (value === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = value;
    const { publicOrigin } = await import('@/lib/nowpayments');
    expect(publicOrigin()).toBeNull();
  });
});

describe('createInvoice', () => {
  it('refuses — without calling the API — when the origin is not reachable', async () => {
    delete process.env.APP_ORIGIN;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { createInvoice } = await import('@/lib/nowpayments');
    const r = await createInvoice({ apiKey: 'k', priceEur: 10, orderId: 'o1', description: 'd' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/APP_ORIGIN/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends the documented body and returns the hosted invoice url', async () => {
    process.env.APP_ORIGIN = 'https://content24market.space';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 4242, invoice_url: 'https://nowpayments.io/i/4242' }), { status: 200 }),
    );
    const { createInvoice } = await import('@/lib/nowpayments');
    const r = await createInvoice({ apiKey: 'SECRET_KEY', priceEur: 10, orderId: 'o1', description: '1000 tokens - Content Box' });
    expect(r).toEqual({ ok: true, url: 'https://nowpayments.io/i/4242', id: '4242' });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.nowpayments.io/v1/invoice');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('SECRET_KEY');
    const body = JSON.parse(String(init.body));
    expect(body.price_amount).toBe(10);
    expect(body.price_currency).toBe('eur');
    expect(body.order_id).toBe('o1');
    expect(body.ipn_callback_url).toBe('https://content24market.space/api/wallet/crypto/webhook');
  });

  it("carries the provider's own error out instead of swallowing it", async () => {
    process.env.APP_ORIGIN = 'https://content24market.space';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"message":"Invalid API key"}', { status: 403 }),
    );
    const { createInvoice } = await import('@/lib/nowpayments');
    const r = await createInvoice({ apiKey: 'SECRET_KEY', priceEur: 10, orderId: 'o1', description: 'd' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain('403');
      expect(r.reason).toContain('Invalid API key');
      expect(r.reason).not.toContain('SECRET_KEY'); // never echo the key
    }
  });
});

describe('verifyIpn', () => {
  // NOWPayments signs JSON.stringify(sortObjectDeep(payload)) with HMAC-SHA512.
  const sign = (body: unknown, secret: string) => {
    const sortDeep = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(sortDeep);
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(o).sort()) out[k] = sortDeep(o[k]);
        return out;
      }
      return v;
    };
    return createHmac('sha512', secret).update(JSON.stringify(sortDeep(body))).digest('hex');
  };

  it('accepts a correct signature regardless of key order in the payload', async () => {
    const { verifyIpn } = await import('@/lib/nowpayments');
    const body = { payment_status: 'finished', order_id: 'o1', payment_id: 99, nested: { b: 2, a: 1 } };
    const reordered = { nested: { a: 1, b: 2 }, payment_id: 99, order_id: 'o1', payment_status: 'finished' };
    expect(verifyIpn(body, sign(reordered, 'IPNSECRET'), 'IPNSECRET')).toBe(true);
  });

  it('rejects a tampered amount, a wrong secret and a missing signature', async () => {
    const { verifyIpn } = await import('@/lib/nowpayments');
    const body = { payment_status: 'finished', order_id: 'o1', payment_id: 99 };
    const good = sign(body, 'IPNSECRET');
    expect(verifyIpn({ ...body, order_id: 'SOMEONE_ELSE' }, good, 'IPNSECRET')).toBe(false);
    expect(verifyIpn(body, good, 'WRONG_SECRET')).toBe(false);
    expect(verifyIpn(body, '', 'IPNSECRET')).toBe(false);
    expect(verifyIpn(body, 'deadbeef', 'IPNSECRET')).toBe(false);
  });
});
