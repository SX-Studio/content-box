import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getLocale } from '@/lib/i18n/server';
import { I18nProvider } from './i18n-provider';

// icon.png / apple-icon.png in app/ are picked up as favicon + touch icon
// automatically; manifest.ts adds the installable PWA icons.
export const metadata: Metadata = {
  metadataBase: new URL('https://content24market.space'),
  title: 'Content Box',
  description: 'Temporary multi-creator content rental marketplace.',
  applicationName: 'Content Box',
  appleWebApp: { capable: true, title: 'Content Box', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#000000',
};

// async so the locale is known before the first byte: <html lang> must be right for
// screen readers and translation tools, and the provider must hand the locale down
// before anything renders or the page would flash English first.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <head>
        {/* One stylesheet, one origin. Figtree is the landing's face only; Google Fonts
            serves the css for every family here but the browser downloads a family's
            woff2 only on a page that uses it, so the app pages pay nothing for it. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Poppins:wght@500;600;700;800&display=swap"
        />
      </head>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
