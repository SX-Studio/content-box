import 'server-only';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, DEFAULT_LOCALE, isLocale, localeFromAcceptLanguage, type Locale } from './locales';
import { makeT } from './index';

// Locale for a server render: an explicit choice (cookie) always beats the browser's
// Accept-Language, so switching language sticks even for someone whose browser asks
// for something else.
//
// Next 14: cookies() and headers() are async — unlike SX's Next 13.5.1.
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return localeFromAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE;
}

export async function getT() {
  return makeT(await getLocale());
}
