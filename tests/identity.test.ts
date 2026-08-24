import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ageFromDob, DOCUMENT_TYPES } from '@/lib/identity';

describe('ageFromDob', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-24T00:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('computes whole-year age', () => {
    expect(ageFromDob('2000-01-01')).toBe(26);
    expect(ageFromDob('2008-08-24')).toBe(18); // exactly 18 today
    expect(ageFromDob('2008-08-25')).toBe(17); // one day short of 18
  });

  it('throws on an invalid date', () => {
    expect(() => ageFromDob('not-a-date')).toThrow(/Invalid date/);
  });

  it('exposes the allowed document types', () => {
    expect(DOCUMENT_TYPES).toEqual(['passport', 'id_card', 'drivers_license']);
  });
});
