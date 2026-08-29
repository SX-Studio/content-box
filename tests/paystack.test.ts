import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';

describe('paystack signature', () => {
  it('signs the raw body as HMAC-SHA512 hex of the secret', async () => {
    const { signPaystack } = await import('@/lib/paystack');
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ORD-ABC' } });
    const expected = createHmac('sha512', 'sk_test_key').update(body).digest('hex');
    expect(signPaystack(body, 'sk_test_key')).toBe(expected);
  });

  it('verifies a valid signature and rejects a tampered body or empty signature', async () => {
    const { signPaystack, verifyPaystackSignature } = await import('@/lib/paystack');
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ORD-ABC', status: 'success' } });
    const sig = signPaystack(body, 'sk_test_key');
    expect(verifyPaystackSignature(body, sig, 'sk_test_key')).toBe(true);
    expect(verifyPaystackSignature(body + ' ', sig, 'sk_test_key')).toBe(false);
    expect(verifyPaystackSignature(body, sig, 'wrong_key')).toBe(false);
    expect(verifyPaystackSignature(body, '', 'sk_test_key')).toBe(false);
  });
});

describe('paystack EUR→KES conversion', () => {
  it('converts EUR cents to KES subunits (KES×100) at the given rate', async () => {
    const { eurCentsToKesSubunits } = await import('@/lib/paystack');
    // €5.00 at 145 KES/EUR = 725 KES = 72_500 subunits
    expect(eurCentsToKesSubunits(500, 145)).toBe(72_500);
    // €10.00 at 145 = 1450 KES = 145_000 subunits
    expect(eurCentsToKesSubunits(1000, 145)).toBe(145_000);
    // €25.00 at 150.5 = 3762.5 KES → rounded to 376_250 subunits
    expect(eurCentsToKesSubunits(2500, 150.5)).toBe(376_250);
  });

  it('rounds to the nearest subunit', async () => {
    const { eurCentsToKesSubunits } = await import('@/lib/paystack');
    // €1.99 at 145 = 288.55 KES = 28_855 subunits (exact)
    expect(eurCentsToKesSubunits(199, 145)).toBe(28_855);
    // fractional rate that would produce a fractional subunit → rounded
    expect(eurCentsToKesSubunits(333, 145.1234)).toBe(Math.round((333 / 100) * 145.1234 * 100));
  });
});
