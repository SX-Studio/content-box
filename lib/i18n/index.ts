import { en, type Dict } from './en';
import { nl } from './nl';
import { pt } from './pt';
import { DEFAULT_LOCALE, type Locale } from './locales';

export type { Dict } from './en';
export * from './locales';

export const DICTS: Record<Locale, Dict> = { en, nl, pt };

// Dot path into the dictionary, e.g. 'login.sendCode'. Typed so a renamed or deleted
// key is a compile error at every call site, not a blank label in production.
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Leaves<Dict>;

function lookup(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export type Vars = Record<string, string | number>;

// Resolve a key for a locale. Falls back to English and then to the key itself, so a
// gap degrades to readable English rather than an empty element. The type system
// should make both fallbacks unreachable; they exist for hand-edited dictionaries.
export function translate(locale: Locale, key: TKey, vars?: Vars): string {
  const raw = lookup(DICTS[locale] ?? en, key) ?? lookup(en, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

export function makeT(locale: Locale) {
  return (key: TKey, vars?: Vars) => translate(locale, key, vars);
}
export type T = ReturnType<typeof makeT>;

export { DEFAULT_LOCALE };
