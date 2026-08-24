import Link from 'next/link';

export default function LegalIndex() {
  const docs = [
    ['/legal/terms', 'Terms of Service', 'The rules for using Content Box.'],
    ['/legal/privacy', 'Privacy Policy', 'What we collect, why, and your rights.'],
    ['/legal/2257', '18 U.S.C. 2257 / Age records', 'Age verification and record-keeping compliance.'],
    ['/legal/dmca', 'DMCA & content complaints', 'Report infringing or non-consensual content.'],
    ['/legal/refunds', 'Refund policy', 'Tokens, rentals and chargebacks.'],
  ];
  return (
    <>
      <h1>Legal</h1>
      <p className="dim">Policies governing Content Box (content24market.space).</p>
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        {docs.map(([href, title, desc]) => (
          <Link key={href} href={href} className="card" style={{ display: 'block', textDecoration: 'none' }}>
            <strong>{title}</strong>
            <div className="dim" style={{ fontSize: 13 }}>{desc}</div>
          </Link>
        ))}
      </div>
      <p className="dim" style={{ fontSize: 12, marginTop: 20 }}>
        These documents are drafts provided as a starting point and must be reviewed by qualified legal counsel before launch.
      </p>
    </>
  );
}
