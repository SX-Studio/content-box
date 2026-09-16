// Supported UI languages. English is the source of truth: the dictionary type is
// derived from it, so a missing key in nl/pt is a compile error rather than a blank
// label discovered by a user.
export const LOCALES = ['en', 'nl', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'cb_locale';

// Shown in the switcher. Endonyms — a Portuguese speaker looks for "Português",
// not "Portuguese".
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  nl: 'Nederlands',
  pt: 'Português',
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

// Pick a locale from an Accept-Language header. Quality values are respected, and a
// regional tag matches its base language (pt-BR -> pt, nl-BE -> nl) so a Brazilian
// creator and a Belgian buyer both land on their own language without configuring
// anything. Unknown or absent -> English.
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      const weight = q ? Number.parseFloat(q.split('=')[1]) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((r) => r.tag && r.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
