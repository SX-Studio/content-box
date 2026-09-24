import { describe, it, expect } from 'vitest';
import {
  validateDisplayName,
  normalizeDisplayName,
  displayNameKey,
  participantLabel,
  DISPLAY_NAME_MAX,
} from '@/lib/display-name';

describe('normalizeDisplayName', () => {
  it('trims and collapses whitespace so one name has one form', () => {
    expect(normalizeDisplayName('  Ana   B  ')).toBe('Ana B');
    expect(normalizeDisplayName('Ana\tB')).toBe('Ana B');
  });

  it('composes accents (NFC) so the same-looking name is the same name', () => {
    // "José" typed with a combining acute vs. a precomposed é.
    const decomposed = 'José';
    expect(normalizeDisplayName(decomposed)).toBe('José');
    expect(displayNameKey(decomposed)).toBe(displayNameKey('José'));
  });

  it('survives non-string input', () => {
    expect(normalizeDisplayName(null)).toBe('');
    expect(normalizeDisplayName(undefined)).toBe('');
  });
});

describe('displayNameKey', () => {
  // The key must match the GENERATED column in 0023: lower(btrim(display_name)).
  it('is case-folded, so "ANA" cannot coexist with "ana"', () => {
    expect(displayNameKey('ANA b')).toBe('ana b');
    expect(displayNameKey(' Ana B ')).toBe(displayNameKey('ana b'));
  });
});

describe('validateDisplayName', () => {
  it('accepts ordinary names, including accents and other scripts', () => {
    expect(validateDisplayName('Ana B')).toBe('Ana B');
    expect(validateDisplayName('José')).toBe('José');
    expect(validateDisplayName('Sanne_99')).toBe('Sanne_99');
    expect(validateDisplayName("O'Hara")).toBe("O'Hara");
    expect(validateDisplayName('  Mia  ')).toBe('Mia');
  });

  it('rejects empty and too-short names', () => {
    expect(() => validateDisplayName('')).toThrow();
    expect(() => validateDisplayName('   ')).toThrow();
    expect(() => validateDisplayName('a')).toThrow(/at least/);
  });

  it('measures length in characters, not UTF-16 units', () => {
    // 24 accented characters is 24 to the person typing it.
    const ok = 'é'.repeat(DISPLAY_NAME_MAX);
    expect(validateDisplayName(ok)).toHaveLength(DISPLAY_NAME_MAX);
    expect(() => validateDisplayName('é'.repeat(DISPLAY_NAME_MAX + 1))).toThrow(/at most/);
  });

  // ⚠️ The privacy rule: a nickname is plain text shown to every member, and a phone
  // number must never be stored in plain text anywhere in this product.
  it('refuses anything that carries a phone number, however it is punctuated', () => {
    expect(() => validateDisplayName('31612345678')).toThrow(/phone number/);
    expect(() => validateDisplayName('+31 6 1234 5678')).toThrow();
    expect(() => validateDisplayName('06-12345678')).toThrow(/phone number/);
    expect(() => validateDisplayName('call 5551234')).toThrow(/phone number/);
    // A few digits are fine — people put years and numbers in names.
    expect(validateDisplayName('Ana 2000')).toBe('Ana 2000');
  });

  it('refuses staff and platform words', () => {
    for (const bad of ['admin', 'Admin', 'MODERATOR', 'support', 'Content24', 'system']) {
      expect(() => validateDisplayName(bad)).toThrow(/reserved/);
    }
  });

  it('refuses names shaped like a public ID', () => {
    expect(() => validateDisplayName('USR-7K3M')).toThrow(/public ID/);
    expect(() => validateDisplayName('crt-abc')).toThrow(/public ID/);
    // Not every word starting with those letters is an ID.
    expect(validateDisplayName('Boxer')).toBe('Boxer');
  });

  it('refuses invisible characters — the cheapest way to clone another name', () => {
    expect(() => validateDisplayName('An​a')).toThrow(/invisible/);
    expect(() => validateDisplayName('Ana﻿')).toThrow(/invisible/);
    expect(() => validateDisplayName('‮Ana')).toThrow(/invisible/);
  });

  it('refuses markup and control characters', () => {
    expect(() => validateDisplayName('<b>Ana</b>')).toThrow();
    expect(() => validateDisplayName('Ana\u0000')).toThrow();
    expect(() => validateDisplayName('a@b.com')).toThrow();
  });
});

describe('participantLabel', () => {
  // The public ID is the identifier of record and is always present: it is what makes
  // two similar-looking nicknames tellable apart.
  it('always keeps the public ID beside the nickname', () => {
    expect(participantLabel('Ana B', 'CRT-7K3M')).toBe('Ana B · CRT-7K3M');
    expect(participantLabel(null, 'CRT-7K3M')).toBe('CRT-7K3M');
    expect(participantLabel('   ', 'USR-1')).toBe('USR-1');
  });
});
