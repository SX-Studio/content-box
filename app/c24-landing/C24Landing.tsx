import Link from 'next/link';
import './c24-landing.css';

/**
 * Content24 Marketplace landing page.
 *
 * DOM and class names come verbatim from the approved HTML design reference
 * (index_2.html). Every style value lives in c24-landing.css; nothing here is
 * computed at runtime. The desktop layout is one artboard: a single 1024x1536
 * artwork (public/brand/c24-plate.webp) with the type and controls positioned over
 * it in `--u` units, so it scales as one piece. Under 760px the artboard is
 * swapped for a flow layout that crops its imagery out of that same one image.
 *
 * Deviations from the reference, all deliberate:
 *  - The reference wires its links from a `CONFIG` object in an inline <script>.
 *    Those are real hrefs here, resolved at render, so the page needs no JS at all.
 *  - Every route into the product points at `/login`, per the standing rule in
 *    CLAUDE.md: the landing offers the sign-in door, it does not drop a signed-out
 *    visitor into the app, and `/login` forwards an already-signed-in one on to
 *    `/app`. That covers all ten entry points — both Download App pills, all four
 *    store badges and both Log in / Register pairs on the phone. The reference
 *    pointed the store badges at `#` and Register at a `/register` route that does
 *    not exist here (registration is invitation-only, see app/invite).
 *  - The phone's Log in / Register hotspots are real links, so neither phone is a
 *    `role="img"` — that would hide them from assistive tech. The purely decorative
 *    crops (feature rings, cube) carry aria-hidden individually instead.
 *  - The footer keeps all five /legal routes and the 18+ notice the rest of the app
 *    carries, not just the reference's Terms and Privacy. They are a compliance
 *    surface, not decoration.
 */

const APP = '/login';
const CONTACT_EMAIL = 'info@content24market.space';

function AppStoreGlyph() {
  return (
    <svg viewBox="0 0 384 512" fill="#fff" aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function GooglePlayGlyph() {
  return (
    <svg viewBox="0 0 48 52" aria-hidden="true">
      <path d="M2 2.5 27 26 2 49.5c-.9-.5-1.5-1.5-1.5-2.8V5.3C.5 4 1.1 3 2 2.5z" fill="#00d7fe" />
      <path d="M35.2 17.8 27 26 2 2.5c.5-.3 1.2-.4 1.9-.3.4.1.8.2 1.2.5l30.1 15.1z" fill="#00f076" />
      <path d="M35.2 34.2 5.1 49.3c-.4.2-.8.4-1.2.5-.7.1-1.4 0-1.9-.3L27 26l8.2 8.2z" fill="#ff3a44" />
      <path d="M45.5 29.3 35.2 34.2 27 26l8.2-8.2 10.3 4.9c2.7 1.4 2.7 5.2 0 6.6z" fill="#ffd500" />
    </svg>
  );
}

export default function C24Landing() {
  return (
    <div className="c24">
      <div className="backdrop" aria-hidden="true"></div>

      {/* ===== Desktop / tablet: the artboard ===== */}
      <div className="stage">
        <div className="art" id="top">
          <a className="logo" href="#top" aria-label="Content24 Marketplace">
            <img src="/brand/c24-mark.webp" alt="" width={200} height={200} />
          </a>
          <a className="wm" href="#top" aria-hidden="true" tabIndex={-1}>
            CONTENT<span className="grad24">24</span>
          </a>
          <div className="mp" aria-hidden="true">-MARKETPLACE-</div>
          <a className="nav n1" href="#how-it-works">How it works</a>
          <a className="nav n2" href="#features">Features</a>
          <a className="nav n3" href="#contact">Contact</a>
          <Link className="dl" href={APP}>Download App</Link>

          <h1 className="hl" style={{ position: 'static' }}>
            <span className="h1" style={{ position: 'absolute' }}>Content</span>
            <span className="h2" style={{ position: 'absolute' }}>24 Hour</span>
            <span className="h3" style={{ position: 'absolute' }}>Group Box.</span>
            <span className="h4" style={{ position: 'absolute' }}>Your World.</span>
            <span className="h5" style={{ position: 'absolute' }}>Your Content.</span>
          </h1>
          <p className="lead">
            Exclusive content from creators<br />in private groups. 24 hours access.<br />No limits.
          </p>

          <span className="anchor" id="download" style={{ left: 'calc(var(--u)*58)', top: 'calc(var(--u)*760)' }}></span>
          <Link className="store as" href={APP} aria-label="Download on the App Store">
            <AppStoreGlyph />
            <span className="t"><small>Download on the</small><strong>App Store</strong></span>
          </Link>
          <Link className="store gp" href={APP} aria-label="Get it on Google Play">
            <GooglePlayGlyph />
            <span className="t"><small>Get it on</small><strong>Google Play</strong></span>
          </Link>

          {/* clickable areas over the phone in the artwork */}
          <Link
            className="hot"
            href={APP}
            aria-label="Log in"
            style={{
              left: 'calc(var(--u)*628)', top: 'calc(var(--u)*546)',
              width: 'calc(var(--u)*244)', height: 'calc(var(--u)*70)',
              transform: 'rotate(4deg)',
            }}
          ></Link>
          <Link
            className="hot"
            href={APP}
            aria-label="Register"
            style={{
              left: 'calc(var(--u)*622)', top: 'calc(var(--u)*622)',
              width: 'calc(var(--u)*240)', height: 'calc(var(--u)*66)',
              transform: 'rotate(4deg)',
            }}
          ></Link>

          <span className="anchor" id="features" style={{ left: 0, top: 'calc(var(--u)*985)' }}></span>
          <div className="f f1">24H ACCESS</div>
          <div className="f f2">SAFE &amp; PRIVATE</div>
          <div className="f f3">CREATORS</div>
          <div className="f f4">SECURE PAYMENTS</div>

          <span className="anchor" id="how-it-works" style={{ left: 0, top: 'calc(var(--u)*1180)' }}></span>
          <h2 className="ide">
            <span className="m">Invite</span> <span className="d">-</span>{' '}
            <span className="c">Drop</span> <span className="d">-</span>{' '}
            <span className="o">Earn</span>
          </h2>
          <p className="par">Invite your friends, drop content<br />and earn together.</p>
          <a className="arrow" href="#contact" aria-label="Get started">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3.5 12h16" />
              <path d="m13.5 5.5 6.5 6.5-6.5 6.5" />
            </svg>
          </a>

          <span className="tl tl1" aria-hidden="true"></span>
          <p className="tag">CREATORS TODAY. A BIGGER TOMORROW.</p>
          <span className="tl tl2" aria-hidden="true"></span>
        </div>
      </div>

      {/* ===== Mobile ===== */}
      <div className="mobile">
        <div className="m-head">
          <a className="m-brand" href="#top" aria-label="Content24 Marketplace">
            <img src="/brand/c24-mark.webp" alt="" width={200} height={200} />
            <span className="m-wm">
              <b>CONTENT<span className="grad24">24</span></b>
              <small>-MARKETPLACE-</small>
            </span>
          </a>
          <Link className="m-dl" href={APP}>Download App</Link>
        </div>
        <h1 className="m-h1">
          <span className="g1">Content</span>
          <span className="g2">24 Hour</span>
          <span className="g3">Group Box.</span>
          <span className="g4 s4">Your World.</span>
          <span className="g5 s5">Your Content.</span>
        </h1>
        <p className="m-lead">Exclusive content from creators in private groups. 24 hours access. No limits.</p>
        <div className="m-stores" id="m-download">
          <Link href={APP} aria-label="Download on the App Store">
            <AppStoreGlyph />
            <span className="t"><small>Download on the</small><strong>App Store</strong></span>
          </Link>
          <Link href={APP} aria-label="Get it on Google Play">
            <GooglePlayGlyph />
            <span className="t"><small style={{ textTransform: 'uppercase' }}>Get it on</small><strong>Google Play</strong></span>
          </Link>
        </div>
        <div className="m-phone crop">
          <Link href={APP} aria-label="Log in" style={{ left: '28%', top: '48.5%', width: '45%', height: '8.5%' }}></Link>
          <Link href={APP} aria-label="Register" style={{ left: '27%', top: '57.5%', width: '44%', height: '8%' }}></Link>
        </div>
        <div className="m-feat">
          <div>
            <div className="m-ring crop" aria-hidden="true" style={{ aspectRatio: '132/132', backgroundSize: '775.758% auto', backgroundPosition: '9.641% 70.798%' }}></div>
            <h3>24H ACCESS</h3>
          </div>
          <div>
            <div className="m-ring crop" aria-hidden="true" style={{ aspectRatio: '132/132', backgroundSize: '775.758% auto', backgroundPosition: '36.547% 70.798%' }}></div>
            <h3>SAFE &amp; PRIVATE</h3>
          </div>
          <div>
            <div className="m-ring crop" aria-hidden="true" style={{ aspectRatio: '132/132', backgroundSize: '775.758% auto', backgroundPosition: '62.668% 70.798%' }}></div>
            <h3>CREATORS</h3>
          </div>
          <div>
            <div className="m-ring crop" aria-hidden="true" style={{ aspectRatio: '132/132', backgroundSize: '775.758% auto', backgroundPosition: '89.35% 70.798%' }}></div>
            <h3>SECURE PAYMENTS</h3>
          </div>
        </div>
        <div className="m-card">
          <div className="m-cube crop" aria-hidden="true"></div>
          <h2>
            <span className="m">INVITE</span> <span className="d">-</span>{' '}
            <span className="c">DROP</span> <span className="d">-</span>{' '}
            <span className="o">EARN</span>
          </h2>
          <p>Invite your friends, drop content and earn together.</p>
          <a className="m-arrow" href="#contact" aria-label="Get started">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.5 12h14.5" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </a>
        </div>
        <p className="m-tag">CREATORS TODAY. A BIGGER TOMORROW.</p>
      </div>

      <section className="contact" id="contact">
        <h2>Let&rsquo;s <span>talk.</span></h2>
        <p>Questions, partnerships or creator onboarding? Send us a message.</p>
        <a className="btn" href={`mailto:${CONTACT_EMAIL}`}>Contact us</a>
      </section>

      <footer>
        <span>&copy; {new Date().getFullYear()} Content24 Marketplace</span>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/2257">Age records</Link>
        <Link href="/legal/dmca">DMCA</Link>
        <Link href="/legal/refunds">Refunds</Link>
        <span>Adults only (18+). Creators are identity-verified before publishing.</span>
      </footer>
    </div>
  );
}
