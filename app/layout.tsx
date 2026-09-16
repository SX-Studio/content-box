import type { Metadata, Viewport } from 'next';
import './globals.css';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
      <body>{children}</body>
    </html>
  );
}
