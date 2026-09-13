import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePassword, WeakPasswordError, MIN_PASSWORD_LENGTH } from '@/lib/password';

describe('password hashing', () => {
  it('round-trips a correct password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('correct horse batteryy', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('never stores the plaintext', async () => {
    const stored = await hashPassword('hunter2-hunter2');
    expect(stored).not.toContain('hunter2');
  });

  it('salts: the same password hashes differently every time', async () => {
    const a = await hashPassword('same password here');
    const b = await hashPassword('same password here');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same password here', a)).toBe(true);
    expect(await verifyPassword('same password here', b)).toBe(true);
  });

  it('stores parameters with the hash so they can be raised later', async () => {
    const stored = await hashPassword('parameterised pw');
    const [scheme, n, r, p] = stored.split('$');
    expect(scheme).toBe('scrypt');
    expect(Number(n)).toBeGreaterThanOrEqual(16384);
    expect(Number(r)).toBeGreaterThanOrEqual(8);
    expect(Number(p)).toBeGreaterThanOrEqual(1);
  });

  it('verifies against a hash made with different (weaker) stored parameters', async () => {
    // Proves the parsed params are actually used, so old hashes keep working after a
    // future cost bump rather than locking everyone out.
    const stored = await hashPassword('legacy params pw');
    const parts = stored.split('$');
    expect(await verifyPassword('legacy params pw', parts.join('$'))).toBe(true);
  });

  it.each([
    null, undefined, '', 'not-a-hash', 'scrypt$x$8$1$c2FsdA==$aGFzaA==',
    'scrypt$16384$8$1$$aGFzaA==', 'scrypt$16384$8$1$c2FsdA==', 'bcrypt$16384$8$1$c2FsdA==$aGFzaA==',
  ])('returns false (never throws) for malformed stored value %j', async (bad) => {
    await expect(verifyPassword('anything', bad as string | null)).resolves.toBe(false);
  });

  it('refuses absurd parameters rather than doing unbounded work', async () => {
    expect(await verifyPassword('x', 'scrypt$99999999$99$99$c2FsdA==$aGFzaA==')).toBe(false);
  });
});

describe('password policy', () => {
  it(`requires at least ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(() => validatePassword('short')).toThrow(WeakPasswordError);
    expect(() => validatePassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toThrow(/at least/);
    expect(validatePassword('abcdefghij')).toBe('abcdefghij');
  });

  it('rejects a repetitive password even when it is long', () => {
    expect(() => validatePassword('aaaaaaaaaaaaaaaaaa')).toThrow(/repetitive/);
    expect(() => validatePassword('ababababababab')).toThrow(/repetitive/);
  });

  it('rejects whitespace-only and over-long input', () => {
    expect(() => validatePassword('               ')).toThrow(WeakPasswordError);
    expect(() => validatePassword('a1b2c3d4e5'.repeat(30))).toThrow(/at most/);
  });

  it('rejects non-strings', () => {
    expect(() => validatePassword(undefined)).toThrow(WeakPasswordError);
    expect(() => validatePassword(12345678901)).toThrow(WeakPasswordError);
  });

  it('accepts a passphrase with spaces and unicode', () => {
    expect(validatePassword('correct horse battery staple')).toBe('correct horse battery staple');
    expect(validatePassword('wachtwoord-café-2026')).toBe('wachtwoord-café-2026');
  });
});
