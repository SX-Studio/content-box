import { describe, it, expect } from 'vitest';
import { validateEconomics } from '@/lib/config';

describe('validateEconomics', () => {
  it('accepts valid values and coerces to number', () => {
    expect(validateEconomics('payout_threshold_eur', '50')).toEqual({ key: 'payout_threshold_eur', value: 50 });
    expect(validateEconomics('creator_split', 0.8)).toEqual({ key: 'creator_split', value: 0.8 });
  });

  it('rejects unknown keys', () => {
    expect(() => validateEconomics('nope', 1)).toThrow(/Unknown setting/);
  });

  it('enforces integer fields', () => {
    expect(() => validateEconomics('tokens_per_euro', 10.5)).toThrow(/whole number/);
    expect(validateEconomics('tokens_per_euro', 100).value).toBe(100);
  });

  it('enforces bounds', () => {
    expect(() => validateEconomics('creator_split', 1.5)).toThrow(/between 0 and 1/);
    expect(() => validateEconomics('rental_hours', 0)).toThrow(/between 1 and 8760/);
    expect(() => validateEconomics('payout_threshold_eur', 'abc')).toThrow(/must be a number/);
  });
});
