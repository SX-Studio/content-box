'use client';
import { createContext, useContext, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { makeT, type TKey, type Vars } from '@/lib/i18n';
import { LOCALE_COOKIE, LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/locales';

// The locale is resolved once on the server (cookie, else Accept-Language) and handed
// down, so the first paint is already in the right language — no flash of English.
const LocaleContext = createContext<Locale>('en');

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}

export function useSetLocale() {
  const router = useRouter();
  return useCallback(
    (next: Locale) => {
      // One year, site-wide, Lax: a language choice is not a credential, but it should
      // survive a session and follow the user across tabs.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      // refresh() re-runs the server render so server components pick the new locale
      // up too — without it only client components would change language.
      router.refresh();
    },
    [router],
  );
}

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useT();
  return (
    <label className="locale-switcher" title={t('common.language')}>
      <span className="sr-only">{t('common.language')}</span>
      <select
        aria-label={t('common.language')}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {compact ? l.toUpperCase() : LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
