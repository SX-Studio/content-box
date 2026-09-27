import { describe, it, expect } from 'vitest';
import { en } from '@/lib/i18n/en';
import { nl } from '@/lib/i18n/nl';
import { pt } from '@/lib/i18n/pt';
import { translate, DICTS } from '@/lib/i18n';
import { LOCALES, localeFromAcceptLanguage, isLocale } from '@/lib/i18n/locales';

// Flatten to dot paths so a whole dictionary can be compared as a set of keys.
function paths(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (typeof node !== 'object' || node === null) return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    paths(v, prefix ? `${prefix}.${k}` : k),
  );
}

function valueAt(dict: unknown, key: string): string {
  let node: unknown = dict;
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part];
  return node as string;
}

const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();

const EN_KEYS = paths(en).sort();

describe('dictionaries', () => {
  // TypeScript already requires every key, but it cannot see an EXTRA key in a
  // translation — a typo'd key would sit there forever, unreachable and untranslated.
  it.each([['nl', nl], ['pt', pt]] as const)('%s has exactly the English key set', (_name, dict) => {
    expect(paths(dict).sort()).toEqual(EN_KEYS);
  });

  // The type system sees `string`, so a translator dropping {count} or renaming it to
  // {aantal} compiles fine and ships a label with a literal brace or a missing number.
  it.each([['nl', nl], ['pt', pt]] as const)('%s keeps every placeholder', (_name, dict) => {
    const wrong = EN_KEYS
      .map((k) => ({ k, want: placeholders(valueAt(en, k)), got: placeholders(valueAt(dict, k)) }))
      .filter((r) => JSON.stringify(r.want) !== JSON.stringify(r.got));
    expect(wrong).toEqual([]);
  });

  it('has a dictionary for every declared locale', () => {
    for (const l of LOCALES) expect(DICTS[l]).toBeTruthy();
  });

  it('never ships an empty label', () => {
    for (const l of LOCALES) {
      const blank = EN_KEYS.filter((k) => valueAt(DICTS[l], k).trim() === '');
      expect(blank).toEqual([]);
    }
  });
});

describe('translate', () => {
  it('returns the locale string', () => {
    expect(translate('nl', 'login.sendCode')).toBe(nl.login.sendCode);
    expect(translate('pt', 'login.sendCode')).toBe(pt.login.sendCode);
  });

  it('substitutes placeholders', () => {
    expect(translate('en', 'wallet.accessHours', { hours: 24 })).toBe('24h access');
  });

  it('leaves an unknown placeholder untouched rather than printing "undefined"', () => {
    expect(translate('en', 'wallet.accessHours', { nope: 1 })).toBe('{hours}h access');
  });

  it('falls back to English for an unknown locale', () => {
    expect(translate('de' as never, 'login.sendCode')).toBe(en.login.sendCode);
  });

  it('falls back to the key itself rather than rendering nothing', () => {
    expect(translate('en', 'does.not.exist' as never)).toBe('does.not.exist');
  });
});

describe('localeFromAcceptLanguage', () => {
  it('matches a regional tag to its base language', () => {
    expect(localeFromAcceptLanguage('pt-BR,pt;q=0.9')).toBe('pt');
    expect(localeFromAcceptLanguage('nl-BE')).toBe('nl');
  });

  it('respects q-values over header order', () => {
    expect(localeFromAcceptLanguage('en;q=0.3,nl;q=0.9')).toBe('nl');
  });

  it('skips a language we do not carry', () => {
    expect(localeFromAcceptLanguage('de-DE,de;q=0.9,pt;q=0.5')).toBe('pt');
  });

  it('ignores a tag explicitly refused with q=0', () => {
    expect(localeFromAcceptLanguage('nl;q=0,pt;q=0.4')).toBe('pt');
  });

  it('defaults to English for absent, empty or unknown headers', () => {
    expect(localeFromAcceptLanguage(null)).toBe('en');
    expect(localeFromAcceptLanguage('')).toBe('en');
    expect(localeFromAcceptLanguage('zz')).toBe('en');
  });
});

describe('isLocale', () => {
  it('accepts only declared locales', () => {
    expect(isLocale('pt')).toBe(true);
    // The cookie is attacker-controlled: it is read straight into the render path,
    // so anything not on the list must fall back, never be trusted as a locale.
    expect(isLocale('pt-BR')).toBe(false);
    expect(isLocale('__proto__')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
