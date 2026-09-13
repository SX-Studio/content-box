import { describe, it, expect } from 'vitest';
import { PACKAGES, findPackage } from '@/lib/packages';

describe('token packages', () => {
  it('offers the €5 … €100 ladder', () => {
    expect(PACKAGES.map((p) => p.eurCents)).toEqual([500, 1000, 2500, 5000, 10000]);
  });

  it('prices every package at exactly 100 tokens per euro', () => {
    // The rate is also configured as tokens_per_euro in app_config. A package that
    // drifts from it would quietly hand out a discount (or overcharge) that no other
    // part of the economics knows about, so pin all of them to the same ratio.
    for (const p of PACKAGES) {
      expect(p.tokens).toBe((p.eurCents / 100) * 100);
    }
  });

  it('has unique ids — findPackage resolves by id, so a duplicate would shadow', () => {
    expect(new Set(PACKAGES.map((p) => p.id)).size).toBe(PACKAGES.length);
  });

  it('is ordered cheapest first, as both purchase UIs render it in array order', () => {
    const cents = PACKAGES.map((p) => p.eurCents);
    expect([...cents].sort((a, b) => a - b)).toEqual(cents);
  });

  it('resolves the new packages and rejects an unknown id', () => {
    expect(findPackage('collector')).toMatchObject({ tokens: 5000, eurCents: 5000 });
    expect(findPackage('platinum')).toMatchObject({ tokens: 10000, eurCents: 10000 });
    expect(findPackage('nope')).toBeUndefined();
  });

  it('uses whole euros, so no package can produce a fractional charge', () => {
    for (const p of PACKAGES) expect(p.eurCents % 100).toBe(0);
  });
});
