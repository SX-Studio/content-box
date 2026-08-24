import Link from 'next/link';

export default function Home() {
  return (
    <div className="center">
      <p className="eyebrow">Content Box</p>
      <h1>Temporary content, shared boxes.</h1>
      <p className="muted">
        Creators drop content into a shared Box. Members browse one feed and rent for 24 hours.
        Sign in with your phone number to continue.
      </p>
      <div className="row" style={{ marginTop: 20 }}>
        <Link href="/login"><button>Sign in</button></Link>
      </div>
      <p className="dim" style={{ marginTop: 28 }}>Adults only (18+). Creators are identity-verified before publishing.</p>

      <nav className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
        <Link href="/legal/terms" className="dim" style={{ fontSize: 13 }}>Terms</Link>
        <Link href="/legal/privacy" className="dim" style={{ fontSize: 13 }}>Privacy</Link>
        <Link href="/legal/2257" className="dim" style={{ fontSize: 13 }}>Age records</Link>
        <Link href="/legal/dmca" className="dim" style={{ fontSize: 13 }}>DMCA</Link>
        <Link href="/legal/refunds" className="dim" style={{ fontSize: 13 }}>Refunds</Link>
      </nav>
    </div>
  );
}
