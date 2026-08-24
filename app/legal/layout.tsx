import Link from 'next/link';

export const metadata = { title: 'Legal · Content Box' };

const LINKS = [
  ['/legal/terms', 'Terms of Service'],
  ['/legal/privacy', 'Privacy Policy'],
  ['/legal/2257', '18 U.S.C. 2257 / Age records'],
  ['/legal/dmca', 'DMCA & content complaints'],
  ['/legal/refunds', 'Refund policy'],
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <div className="between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Link href="/legal" className="dim">← Legal</Link>
        <Link href="/" className="dim">Home</Link>
      </div>
      <article style={{ marginTop: 12, lineHeight: 1.6 }}>{children}</article>
      <hr style={{ margin: '28px 0 14px' }} />
      <nav className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className="dim" style={{ fontSize: 13 }}>{label}</Link>
        ))}
      </nav>
    </div>
  );
}
