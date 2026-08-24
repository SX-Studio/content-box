import { describe, it, expect } from 'vitest';
import { normalizeEmail } from '@/lib/accounts';

describe('normalizeEmail', () => {
  it('lowercases and trims valid addresses', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });

  it('treats empty as null (clears the field)', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });

  it('rejects malformed addresses', () => {
    expect(() => normalizeEmail('nope')).toThrow(/valid email/);
    expect(() => normalizeEmail('a@b')).toThrow(/valid email/);
    expect(() => normalizeEmail('a b@c.com')).toThrow(/valid email/);
  });
});
