import Link from 'next/link';

// Content24 Marketspace — landing homepage. Dark neon marketing page rendered
// server-side (links only, no client JS). All styles are scoped under `.c24` so
// they never touch the app's globals.css design system used by the rest of the app.

export default function Home() {
  return (
    <div className="c24" id="top">
      <style>{c24css}</style>

      {/* ambient background glows */}
      <div className="c24-bg" aria-hidden>
        <span className="c24-glow g1" />
        <span className="c24-glow g2" />
        <span className="c24-glow g3" />
      </div>

      {/* ── header ── */}
      <header className="c24-header">
        <Link href="/" className="c24-brand" aria-label="Content24 Marketspace home">
          <span className="c24-logo" aria-hidden>
            <span className="c24-logo-ring" />
            <span className="c24-logo-c">C</span>
          </span>
          <span className="c24-brand-txt">
            <b>CONTENT24</b>
            <i>— MARKETSPACE —</i>
          </span>
        </Link>

        <nav className="c24-nav">
          <a href="#top">Home</a>
          <a href="#about">Over ons</a>
          <a href="#how">Hoe het werkt</a>
          <a href="#functies">Functies</a>
          <a href="#contact">Contact</a>
        </nav>

        <Link href="/login" className="c24-btn c24-btn-pink c24-download">Download App</Link>
      </header>

      {/* ── hero ── */}
      <section className="c24-hero">
        <div className="c24-phone-wrap" aria-hidden>
          <div className="c24-phone-glow" />
          <div className="c24-phone">
            <div className="c24-notch" />
            <div className="c24-screen">
              <span className="c24-logo lg">
                <span className="c24-logo-ring" />
                <span className="c24-logo-c">C</span>
              </span>
              <div className="c24-screen-brand">
                <b>CONTENT24</b>
                <i>— MARKETSPACE —</i>
              </div>
              <div className="c24-screen-btn primary">Inloggen</div>
              <div className="c24-screen-btn ghost">Registreren</div>
              <div className="c24-lock">
                <svg viewBox="0 0 48 60" width="66" height="82" fill="none">
                  <rect x="6" y="26" width="36" height="30" rx="7" stroke="url(#lg)" strokeWidth="2.5" />
                  <path d="M14 26v-7a10 10 0 0 1 20 0v7" stroke="url(#lg)" strokeWidth="2.5" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="lg" x1="0" y1="0" x2="48" y2="60" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#ff2d9b" />
                      <stop offset="1" stopColor="#7c5cff" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="c24-lock-num">24</span>
              </div>
            </div>
          </div>
        </div>

        <div className="c24-hero-copy">
          <h1 className="c24-h1">
            <span className="w">CONTENT</span>
            <span className="blue">24 UUR.</span>
            <span className="blue">JOUW WERELD.</span>
            <span className="orange">JOUW CONTENT.</span>
          </h1>
          <p className="c24-lead">
            De veilige en exclusieve marktplaats waar creators content delen en fans
            24&nbsp;uur lang toegang krijgen.
          </p>
          <div className="c24-cta-row">
            <Link href="/login" className="c24-btn c24-btn-pink lg">
              Toegang tot de App <span className="chev">›</span>
            </Link>
            <a href="#functies" className="c24-btn c24-btn-ghost lg">
              Meer informatie <span className="chev">›</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── features ── */}
      <section className="c24-features" id="functies">
        <Feature
          title="24 UUR TOEGANG"
          body="Koop content en krijg 24 uur exclusieve toegang."
          icon={
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10" width="16" height="11" rx="3" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          }
        />
        <Feature
          title="VEILIG & PRIVAAT"
          body="Jouw privacy en veiligheid staan bij ons voorop."
          icon={
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 16.5a4 4 0 0 0-2-7.4A5.5 5.5 0 0 0 7 9 4 4 0 0 0 6.5 17H18a3.5 3.5 0 0 0 2-.5Z" />
              <path d="M12 19v-6m0 0-2.2 2.2M12 13l2.2 2.2" />
            </svg>
          }
        />
        <Feature
          title="CREATORS"
          body="Deel jouw content met jouw eigen community."
          icon={
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
              <path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 20a5.5 5.5 0 0 0-3-4.9" />
            </svg>
          }
        />
        <Feature
          title="VEILIGE BETALINGEN"
          body="Snel, veilig en anoniem betalen."
          icon={
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="12" rx="3" />
              <path d="M3 10h18M7 15h4" />
            </svg>
          }
        />
      </section>

      {/* ── footer band ── */}
      <footer className="c24-footer" id="contact">
        <p className="c24-tagline">JOIN. DISCOVER. ENJOY <span>— ONLY 24 HOURS.</span></p>
        <div className="c24-stores">
          <Link href="/login" className="c24-store">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden><path d="M16.4 12.6c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-3-1.6-1.3-.1-2.5.7-3.1.7s-1.6-.7-2.7-.7c-1.4 0-2.6.8-3.4 2-1.4 2.5-.4 6.2 1 8.2.7 1 1.5 2.1 2.5 2.1s1.4-.6 2.6-.6 1.5.6 2.6.6 1.7-1 2.4-2c.7-1.1 1-2.1 1-2.2 0 0-2-.8-2.1-3.2ZM14.6 6.1c.6-.7.9-1.6.8-2.6-.8 0-1.8.6-2.4 1.2-.5.6-1 1.5-.8 2.5.9 0 1.8-.5 2.4-1.1Z" /></svg>
            <span><small>Download on the</small><b>App Store</b></span>
          </Link>
          <Link href="/login" className="c24-store">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path fill="#00e0ff" d="M3.6 2.3 13 12 3.6 21.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1Z" /><path fill="#ffce00" d="m16.8 8.5 2.9 1.7c.9.5.9 1.8 0 2.3l-2.9 1.7L13.8 12l3-3.5Z" /><path fill="#ff3d5f" d="M3.6 2.3c.3-.2.7-.2 1.1 0L16.8 8.5 13.8 12 3.6 2.3Z" /><path fill="#00d95f" d="M3.6 21.7 13.8 12l3 3.5L4.7 21.7c-.4.2-.8.2-1.1 0Z" /></svg>
            <span><small>GET IT ON</small><b>Google Play</b></span>
          </Link>
        </div>
        <nav className="c24-legal">
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/2257">Age records</Link>
          <Link href="/legal/dmca">DMCA</Link>
          <Link href="/legal/refunds">Refunds</Link>
        </nav>
        <p className="c24-fineprint">Adults only (18+). Creators are identity-verified before publishing.</p>
      </footer>
    </div>
  );
}

function Feature({ title, body, icon }: { title: string; body: string; icon: React.ReactNode }) {
  return (
    <div className="c24-feat">
      <span className="c24-feat-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

const c24css = `
.c24 {
  --pink: #ff2d9b; --pink2: #b026ff; --blue: #4da6ff; --violet: #7c5cff;
  --orange: #ff8a3d; --orange2: #ff5030; --cyan: #2dd4ff; --ink: #ece9ff; --dim: #a79fc9;
  position: relative; min-height: 100vh; overflow: hidden;
  background: #05040c; color: var(--ink);
  font-family: 'Poppins', 'IBM Plex Sans', system-ui, sans-serif;
}
.c24 a { color: inherit; text-decoration: none; }
.c24 h1, .c24 h2, .c24 h3, .c24 p, .c24 b, .c24 i { font-family: inherit; }
.c24-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.c24-glow { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55; }
.c24-glow.g1 { width: 620px; height: 620px; left: -180px; top: -120px; background: radial-gradient(circle, #6b3df5, transparent 68%); }
.c24-glow.g2 { width: 680px; height: 680px; right: -220px; top: 40px; background: radial-gradient(circle, #2b6bff, transparent 66%); opacity: .5; }
.c24-glow.g3 { width: 560px; height: 560px; right: 6%; bottom: -220px; background: radial-gradient(circle, #ff5e3a, transparent 66%); opacity: .38; }
.c24 > *:not(.c24-bg) { position: relative; z-index: 1; }

/* logo */
.c24-logo { position: relative; width: 42px; height: 42px; display: inline-grid; place-items: center; flex: none; }
.c24-logo.lg { width: 66px; height: 66px; }
.c24-logo-ring { position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(from 210deg, #ff8a3d, #ff2d9b, #7c5cff, #2dd4ff, #ff8a3d);
  padding: 3.5px; -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px));
}
.c24-logo::after { content: ''; position: absolute; inset: 6px; border-radius: 50%; background: #0a0714; }
.c24-logo.lg::after { inset: 9px; }
.c24-logo-c { position: relative; z-index: 1; font-weight: 800; font-size: 19px;
  background: linear-gradient(135deg, #2dd4ff, #ff2d9b); -webkit-background-clip: text; background-clip: text; color: transparent; }
.c24-logo.lg .c24-logo-c { font-size: 30px; }

/* header */
.c24-header { max-width: 1200px; margin: 0 auto; padding: 22px 26px;
  display: flex; align-items: center; gap: 20px; }
.c24-brand { display: flex; align-items: center; gap: 12px; }
.c24-brand-txt { display: flex; flex-direction: column; line-height: 1; }
.c24-brand-txt b { font-weight: 800; font-size: 21px; letter-spacing: .01em;
  background: linear-gradient(120deg, #c9b6ff, #ff2d9b 60%, #ff8a3d); -webkit-background-clip: text; background-clip: text; color: transparent; }
.c24-brand-txt i { font-style: normal; font-size: 9.5px; letter-spacing: .34em; color: var(--dim); margin-top: 3px; }
.c24-nav { margin-left: auto; display: flex; gap: 30px; }
.c24-nav a { font-size: 14.5px; font-weight: 500; color: #e8e6f7; opacity: .82; transition: opacity .15s, color .15s; }
.c24-nav a:hover { opacity: 1; color: #fff; }
.c24-download { margin-left: 6px; }

/* buttons */
.c24-btn { display: inline-flex; align-items: center; gap: 8px; font-family: inherit;
  font-weight: 600; font-size: 14px; padding: 11px 22px; border-radius: 40px; cursor: pointer;
  border: none; transition: transform .1s, box-shadow .2s, filter .15s; white-space: nowrap; }
.c24-btn.lg { padding: 15px 30px; font-size: 15.5px; }
.c24-btn .chev { font-weight: 700; font-size: 1.15em; line-height: 0; }
.c24-btn-pink { color: #fff; background: linear-gradient(100deg, var(--pink), var(--pink2));
  box-shadow: 0 12px 34px -12px rgba(255,45,155,.75); }
.c24-btn-pink:hover { transform: translateY(-2px); filter: brightness(1.07); box-shadow: 0 18px 40px -12px rgba(255,45,155,.85); }
.c24-btn-ghost { color: #fff; background: rgba(255,255,255,.04);
  border: 1.5px solid rgba(170,150,255,.42); backdrop-filter: blur(6px); }
.c24-btn-ghost:hover { transform: translateY(-2px); border-color: rgba(170,150,255,.85); background: rgba(255,255,255,.08); }
.c24-btn:active { transform: translateY(0); }

/* hero */
.c24-hero { max-width: 1200px; margin: 0 auto; padding: 30px 26px 40px;
  display: grid; grid-template-columns: minmax(280px, 460px) 1fr; gap: 50px; align-items: center; }
.c24-hero-copy { max-width: 560px; }
.c24-h1 { display: flex; flex-direction: column; gap: 2px; margin: 0 0 26px;
  font-weight: 800; font-size: clamp(38px, 6.2vw, 74px); line-height: 1.0; letter-spacing: -.01em; }
.c24-h1 .w { color: #fff; }
.c24-h1 .blue { background: linear-gradient(100deg, var(--blue), var(--violet)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.c24-h1 .orange { background: linear-gradient(100deg, var(--orange), var(--orange2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.c24-lead { font-size: clamp(15px, 1.7vw, 18px); color: #cfc9e8; line-height: 1.6; max-width: 440px; margin: 0 0 30px; }
.c24-cta-row { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }

/* phone */
.c24-phone-wrap { position: relative; display: grid; place-items: center; }
.c24-phone-glow { position: absolute; width: 380px; height: 380px; border-radius: 50%;
  background: radial-gradient(circle, rgba(124,92,255,.55), rgba(255,45,155,.25) 45%, transparent 70%); filter: blur(50px); }
.c24-phone { position: relative; width: 268px; height: 552px; border-radius: 44px;
  background: linear-gradient(160deg, #1a1430, #0b0817); padding: 12px;
  border: 1px solid rgba(150,120,255,.28);
  box-shadow: 0 40px 90px -30px rgba(0,0,0,.85), inset 0 0 0 2px rgba(0,0,0,.5), 0 0 60px -14px rgba(124,92,255,.5);
  animation: c24float 6s ease-in-out infinite; }
.c24-notch { position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
  width: 96px; height: 8px; border-radius: 6px; background: rgba(0,0,0,.6); z-index: 3; }
.c24-screen { height: 100%; border-radius: 34px; overflow: hidden;
  background: radial-gradient(120% 60% at 50% 0%, #241a44, #0a0716 70%);
  display: flex; flex-direction: column; align-items: center; padding: 54px 26px 30px; text-align: center; }
.c24-screen-brand { display: flex; flex-direction: column; line-height: 1; margin: 14px 0 26px; }
.c24-screen-brand b { font-weight: 800; font-size: 20px;
  background: linear-gradient(120deg, #c9b6ff, #ff2d9b 60%, #ff8a3d); -webkit-background-clip: text; background-clip: text; color: transparent; }
.c24-screen-brand i { font-style: normal; font-size: 8.5px; letter-spacing: .3em; color: var(--dim); margin-top: 4px; }
.c24-screen-btn { width: 100%; padding: 12px; border-radius: 30px; font-weight: 600; font-size: 14px; margin-bottom: 12px; }
.c24-screen-btn.primary { color: #fff; background: linear-gradient(100deg, var(--pink), var(--pink2)); box-shadow: 0 10px 26px -12px rgba(255,45,155,.8); }
.c24-screen-btn.ghost { color: #e9e5ff; border: 1.5px solid rgba(170,150,255,.4); }
.c24-lock { position: relative; margin-top: auto; display: grid; place-items: center;
  filter: drop-shadow(0 0 14px rgba(255,45,155,.55)); }
.c24-lock-num { position: absolute; bottom: 8px; font-weight: 800; font-size: 20px;
  background: linear-gradient(135deg, var(--pink), var(--violet)); -webkit-background-clip: text; background-clip: text; color: transparent; }
@keyframes c24float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }

/* features */
.c24-features { max-width: 1120px; margin: 20px auto 0; padding: 40px 26px;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 26px; }
.c24-feat { text-align: center; padding: 0 6px; }
.c24-feat-icon { display: inline-grid; place-items: center; width: 62px; height: 62px; border-radius: 50%;
  color: #d9d2ff; background: radial-gradient(circle at 35% 30%, rgba(124,92,255,.32), rgba(255,45,155,.14));
  border: 1px solid rgba(150,120,255,.32); box-shadow: 0 0 30px -10px rgba(124,92,255,.6); margin-bottom: 16px; }
.c24-feat h3 { font-weight: 700; font-size: 15px; letter-spacing: .04em; color: #fff; margin: 0 0 8px; }
.c24-feat p { font-size: 13px; line-height: 1.55; color: var(--dim); margin: 0; max-width: 190px; margin-inline: auto; }

/* footer */
.c24-footer { text-align: center; padding: 46px 26px 60px; margin-top: 20px;
  border-top: 1px solid rgba(150,120,255,.16);
  background: linear-gradient(0deg, rgba(90,40,180,.22), transparent); }
.c24-tagline { font-weight: 800; font-size: clamp(16px, 2.4vw, 22px); letter-spacing: .04em; margin: 0 0 24px;
  background: linear-gradient(100deg, #ff8a3d, #ff2d9b, #7c5cff); -webkit-background-clip: text; background-clip: text; color: transparent; }
.c24-tagline span { display: inline; }
.c24-stores { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
.c24-store { display: inline-flex; align-items: center; gap: 10px; padding: 10px 20px; border-radius: 12px;
  background: #0c0a18; border: 1px solid rgba(255,255,255,.14); color: #fff; transition: border-color .15s, transform .1s; }
.c24-store:hover { border-color: rgba(170,150,255,.6); transform: translateY(-2px); }
.c24-store span { display: flex; flex-direction: column; line-height: 1.15; text-align: left; }
.c24-store small { font-size: 9px; letter-spacing: .08em; opacity: .7; text-transform: uppercase; }
.c24-store b { font-size: 15px; font-weight: 700; }
.c24-legal { display: flex; justify-content: center; flex-wrap: wrap; gap: 18px; margin: 30px 0 12px; }
.c24-legal a { font-size: 13px; color: var(--dim); transition: color .15s; }
.c24-legal a:hover { color: #fff; }
.c24-fineprint { font-size: 12.5px; color: #776f9c; margin: 0; }

/* responsive */
@media (max-width: 900px) {
  .c24-nav { display: none; }
  .c24-hero { grid-template-columns: 1fr; gap: 36px; padding-top: 10px; }
  .c24-phone-wrap { order: 2; }
  .c24-hero-copy { order: 1; margin-inline: auto; text-align: center; }
  .c24-lead { margin-inline: auto; }
  .c24-cta-row { align-items: center; }
  .c24-features { grid-template-columns: repeat(2, 1fr); gap: 34px 20px; }
}
@media (max-width: 460px) {
  .c24-header { flex-wrap: wrap; justify-content: space-between; }
  .c24-features { grid-template-columns: 1fr; }
  .c24-phone { transform: scale(.92); }
}
@media (prefers-reduced-motion: reduce) { .c24-phone { animation: none; } .c24-btn { transition: none; } }
`;
