import type { Metadata, Viewport } from 'next';
import C24Landing from './c24-landing/C24Landing';

// Head values come from the design reference. They are exported here rather than from
// app/layout.tsx so they apply to the landing only — every other route keeps the
// root layout's "Content Box" title and #000000 theme colour.
export const metadata: Metadata = {
  title: 'Content24 Marketplace – Content 24 Hour Group Box',
  description:
    'Exclusive content from creators in private groups. 24 hours access. No limits. ' +
    'Invite, drop and earn together with Content24 Marketplace.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    title: 'Content24 Marketplace – Your world. Your content.',
    description: 'Exclusive content from creators in private groups. 24 hours access. No limits.',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#021838',
};

export default function Home() {
  return <C24Landing />;
}
