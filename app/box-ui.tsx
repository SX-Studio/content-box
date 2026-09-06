'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// Shared UI for the Content Box surfaces (group box, discover, rentals): one card
// language + design tokens so /box/[id], /discover and /rentals read as one product.
// Styling piggybacks on the app's globals.css tokens (ember/gold/Fraunces).

export type FeedItem = {
  public_id: string;
  title: string;
  price_tokens: number;
  creator: string | null;
  is_owner?: boolean;
  asset_count?: number;
  media_type: 'image' | 'video';
  preview_url: string | null;
  box_name?: string;
  box_public_id?: string;
};

export function fmtCountdown(iso: string): string {
  let s = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

const GRADS = [
  'linear-gradient(135deg,#e85d78,#7b2ff7)',
  'linear-gradient(135deg,#f7971e,#d92662)',
  'linear-gradient(135deg,#11998e,#38ef7d)',
  'linear-gradient(135deg,#8e2de2,#f9508b)',
  'linear-gradient(135deg,#c94b4b,#4b134f)',
  'linear-gradient(135deg,#0083b0,#ff5f6d)',
  'linear-gradient(135deg,#654ea3,#eaafc8)',
  'linear-gradient(135deg,#d38312,#a83279)',
];
const AV_COLORS = ['#e85d78', '#f7971e', '#11998e', '#8e2de2', '#0083b0', '#d94e2f', '#654ea3', '#c94b4b'];
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
export function gradOf(s: string) { return GRADS[hash(s) % GRADS.length]; }
export function avColorOf(s: string) { return AV_COLORS[hash(s) % AV_COLORS.length]; }

export const PhotoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M4 18l5-4 3 2 4-4 4 4" /></svg>
);
export const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" /></svg>
);
export const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4.5" y="10" width="15" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);
export const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
);

// One rentable content card, shared by the group box and the discover feed.
export function FeedCard({ item, expiry, rentedNow, selected, onToggle, onRent, renting, onReported, showBox, showReport }: {
  item: FeedItem;
  expiry: string | null;
  rentedNow: boolean;
  selected: boolean;
  onToggle: () => void;
  onRent: () => void;
  renting: boolean;
  onReported: () => void;
  showBox?: boolean;
  showReport?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!expiry) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [expiry]);

  const owner = !!item.is_owner;
  const unlocked = owner || rentedNow;

  async function view() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/content/${item.public_id}/view`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not open');
      setUrl(j.url);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function report() {
    const reason = window.prompt('Waarom rapporteer je deze content? (3–80 tekens)');
    if (!reason) return;
    const r = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentId: item.public_id, reason }) });
    if (r.ok) onReported(); else setErr((await r.json()).error || 'Kon niet rapporteren');
  }

  const grad = gradOf(item.public_id);
  const showBlur = !url && !unlocked;

  return (
    <div className={`bx-card ${selected ? 'sel' : ''}`}>
      <div className="bx-media" onClick={() => { if (!owner && !rentedNow) onToggle(); }}>
        {url ? (
          item.media_type === 'video'
            ? <video src={url} controls playsInline className="bx-real" />
            : <img src={url} alt={item.title} className="bx-real" />
        ) : (
          <>
            {item.preview_url
              ? <div className={`bx-ph ${showBlur ? 'blur' : ''}`} style={{ backgroundImage: `url(${item.preview_url})` }} />
              : <div className={`bx-ph ${showBlur ? 'blur' : ''}`} style={{ backgroundImage: grad }} />}
            <div className="bx-face">{item.media_type === 'video' ? <VideoIcon /> : <PhotoIcon />}</div>
          </>
        )}

        <div className="bx-tags">
          <span className="bx-tg">{item.public_id}</span>
          {item.media_type === 'video' && <span className="bx-tg">▶ VIDEO</span>}
        </div>

        {!owner && !rentedNow && (
          <button type="button" className={`bx-sel ${selected ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label="Select">
            {selected ? '✓' : ''}
          </button>
        )}

        <div className="bx-lockrow">
          <span className="bx-lk">
            {owner ? <>✦ Jouw content</>
              : rentedNow ? <><LockIcon /> Gehuurd · <span className="bx-cd">{fmtCountdown(expiry!)}</span></>
              : <><LockIcon /> Blurred preview · huur om te bekijken</>}
          </span>
        </div>
      </div>

      <div className="bx-body">
        <div className="bx-crow">
          <span className="bx-av" style={{ background: avColorOf(item.creator || '?') }}>{(item.creator || '?')[0].toUpperCase()}</span>
          <span className="bx-cname">Creator {item.creator}</span>
        </div>
        <div className="bx-title">{item.title}</div>
        <div className="bx-meta">
          {showBox && item.box_public_id
            ? <a className="bx-boxlink" href={`/box/${item.box_public_id}`} onClick={(e) => e.stopPropagation()}>◫ {item.box_name}</a>
            : null}
          <span>{item.media_type === 'video' ? 'video' : `${item.asset_count ?? ''} foto${item.asset_count === 1 ? '' : "'s"}`.trim()}</span>
          <span>24u toegang</span>
        </div>
        <div className="bx-buyrow">
          <span className="bx-price">◈ {item.price_tokens}</span>
          {unlocked
            ? <button className="bx-btn ember" onClick={view} disabled={busy}>{busy ? '…' : url ? 'Refresh' : 'Bekijk'}</button>
            : <button className="bx-btn ember" onClick={onRent} disabled={renting}>{renting ? '…' : 'Rent 24u'}</button>}
        </div>
        {err && <div className="bx-err">{err}</div>}
        {showReport && !owner && <button onClick={report} className="bx-report">⚑ Rapporteer</button>}
      </div>
    </div>
  );
}

// Bottom tab bar shared across the member surfaces. Highlights the active tab from
// the current route (a /box/* page counts as Discover). Mount once per page.
export function BottomNav() {
  const path = usePathname() || '';
  const tabs = [
    { href: '/discover', label: 'Discover', active: path === '/discover' || path.startsWith('/box'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg> },
    { href: '/rentals', label: 'Rentals', active: path === '/rentals',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg> },
    { href: '/wallet', label: 'Wallet', active: path === '/wallet',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" /></svg> },
    { href: '/app', label: 'Dashboard', active: path === '/app',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 11l9-7 9 7" /><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" /></svg> },
  ];
  return (
    <nav className="bx-nav">
      <div className="bx-nav-inner">
        {tabs.map((t) => (
          <a key={t.href} href={t.href} className={`bx-nav-btn ${t.active ? 'on' : ''}`}>
            {t.icon}
            <span>{t.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

export const boxCss = `
.boxui{max-width:940px;margin:0 auto;padding:22px 18px 140px;position:relative}
.boxui .bx-loading{color:var(--ink-3);padding:40px 4px}

/* top bar */
.bx-top{display:flex;align-items:center;gap:11px;padding:6px 2px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.bx-badge{width:44px;height:44px;border-radius:13px;flex:none;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,var(--ember),#8f2f1c);color:#fff;font-size:21px;box-shadow:0 6px 16px -6px var(--ember)}
.bx-badge svg{width:22px;height:22px}
.bx-titles{min-width:0}
.bx-name{font-family:var(--serif);font-weight:600;font-size:22px;line-height:1.1;letter-spacing:-.01em}
.bx-sub{font-size:12px;color:var(--ink-3)}
.bx-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:8px 13px;font-family:var(--mono);
  font-size:13px;font-weight:500;text-decoration:none;cursor:pointer;border:1px solid var(--line-2);background:var(--surface-2);color:var(--ink-2);transition:border-color .15s,color .15s}
.bx-chip:hover{border-color:var(--ink-3);color:var(--ink)}
.bx-chip.wallet{margin-left:auto;background:rgba(169,118,42,.12);color:var(--gold);border-color:transparent;font-weight:600}
@media(max-width:560px){.bx-chip.wallet{margin-left:0}.bx-top{gap:8px}}

/* filter pills */
.bx-pills{display:flex;flex-wrap:wrap;gap:8px;margin:16px 2px 0}
.bx-pill{border:1px solid var(--line-2);background:var(--surface-2);color:var(--ink-2);border-radius:999px;
  padding:7px 14px;font-size:13px;font-weight:500;cursor:pointer;font-family:var(--sans);transition:border-color .15s,color .15s}
.bx-pill:hover{border-color:var(--ink-3);color:var(--ink)}
.bx-pill.on{background:var(--ember);border-color:var(--ember);color:#fff}

/* view head */
.bx-vhead{display:flex;align-items:baseline;justify-content:space-between;margin:22px 2px 14px}
.bx-vhead h2{font-family:var(--serif);font-weight:600;font-size:22px;margin:0}
.bx-cnt{font-family:var(--mono);font-size:12px;color:var(--ink-3)}

/* grid */
.bx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}

/* card */
.bx-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:var(--shadow);
  transition:transform .18s cubic-bezier(.2,.7,.2,1),box-shadow .18s,border-color .15s}
.bx-card:hover{transform:translateY(-3px);box-shadow:0 20px 44px -22px rgba(0,0,0,.5),var(--shadow)}
.bx-card.sel{border-color:var(--ember);box-shadow:0 0 0 1px var(--ember),var(--shadow)}
.bx-media{position:relative;aspect-ratio:4/5;overflow:hidden;cursor:pointer;background:#141019}
.bx-ph{position:absolute;inset:0;background-size:cover;background-position:center;transition:filter .5s,transform .5s}
.bx-ph.blur{filter:blur(26px) saturate(1.2) brightness(.9);transform:scale(1.18)}
.bx-real{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
video.bx-real{object-fit:contain;background:#000}
.bx-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);pointer-events:none}
.bx-face svg{width:70px;height:70px;opacity:.9;filter:drop-shadow(0 4px 12px rgba(0,0,0,.4))}
.bx-tags{position:absolute;top:10px;left:10px;display:flex;gap:6px;flex-wrap:wrap}
.bx-tg{font-family:var(--mono);font-size:10px;letter-spacing:.04em;background:rgba(8,9,14,.55);backdrop-filter:blur(6px);color:#fff;padding:4px 8px;border-radius:6px}
.bx-sel{position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:50%;border:1.5px solid rgba(255,255,255,.7);
  background:rgba(8,9,14,.4);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;font-size:15px;padding:0;line-height:1}
.bx-sel.on{background:var(--ember);border-color:var(--ember)}
.bx-lockrow{position:absolute;left:0;right:0;bottom:0;padding:12px 13px;background:linear-gradient(to top,rgba(6,7,12,.82),transparent);color:#fff;pointer-events:none}
.bx-lk{font-size:11.5px;display:inline-flex;align-items:center;gap:5px;opacity:.94}
.bx-cd{font-family:var(--mono)}
.bx-body{padding:12px 14px 14px}
.bx-crow{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.bx-av{width:22px;height:22px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:600}
.bx-cname{font-size:12px;color:var(--ink-2)}
.bx-title{font-family:var(--serif);font-weight:600;font-size:16px;margin:0 0 3px;letter-spacing:-.01em}
.bx-meta{font-size:12px;color:var(--ink-3);display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.bx-boxlink{color:var(--teal);text-decoration:none;font-family:var(--mono);font-size:11px}
.bx-boxlink:hover{text-decoration:underline}
.bx-buyrow{display:flex;align-items:center;gap:10px}
.bx-price{font-family:var(--mono);font-weight:500;font-size:15px;color:var(--gold);display:inline-flex;align-items:center;gap:5px}
.bx-btn{border:none;cursor:pointer;font-family:var(--sans);font-weight:600;font-size:13.5px;border-radius:11px;padding:10px 15px;transition:filter .15s,transform .05s;color:#fff;background:linear-gradient(135deg,var(--ember),var(--ember-d))}
.bx-btn.ember{margin-left:auto}
.bx-btn:hover{filter:brightness(1.06)}
.bx-btn:active{transform:scale(.98)}
.bx-btn:disabled{opacity:.5;cursor:not-allowed}
.bx-btn.block{width:100%;margin-left:0;justify-content:center;display:flex;align-items:center;gap:8px}
.bx-btn.ghost{background:var(--surface-2);color:var(--ink);border:1px solid var(--line-2);box-shadow:none}
.bx-err{font-size:12.5px;margin-top:8px;padding:8px 11px;border-radius:9px;background:rgba(228,106,88,.12);color:var(--bad)}
.bx-ok{font-size:12.5px;margin-top:8px;padding:8px 11px;border-radius:9px;background:rgba(84,181,129,.13);color:var(--ok)}
.bx-report{margin-top:8px;padding:4px 0;font-size:11px;background:none;border:none;color:var(--ink-3);cursor:pointer}
.bx-report:hover{color:var(--ink-2)}

/* library (rentals) cards */
.bx-rcard{display:flex;gap:13px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px;box-shadow:var(--shadow)}
.bx-rthumb{width:76px;height:76px;border-radius:13px;flex:none;position:relative;overflow:hidden;background:#141019}
.bx-rthumb .bx-ph,.bx-rthumb .bx-real{border-radius:13px}
.bx-rmeta{flex:1;min-width:0}
.bx-rmeta .t{font-family:var(--serif);font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bx-rmeta .c{font-size:11.5px;color:var(--ink-3)}
.bx-timer{font-family:var(--mono);font-size:14px;font-weight:500;color:var(--teal);display:inline-flex;align-items:center;gap:5px;margin-top:4px}
.bx-timer.warn{color:var(--warn)}
.bx-timer.exp{color:var(--bad)}
.bx-rcard.expired{opacity:.6}
.bx-rcard.expired .bx-ph,.bx-rcard.expired .bx-real{filter:blur(18px) grayscale(.6);transform:scale(1.2)}
.bx-ract{margin-left:auto;flex:none}

/* empty */
.bx-empty{text-align:center;padding:56px 20px;color:var(--ink-3)}
.bx-empty svg{width:44px;height:44px;opacity:.5;margin-bottom:10px}
.bx-empty .h{font-family:var(--serif);font-size:19px;color:var(--ink-2);margin-bottom:4px}
.bx-empty p{font-size:13px;margin:0}

/* drop */
.bx-drop{margin-top:18px;background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);overflow:hidden}
.bx-drop-toggle{width:100%;display:flex;align-items:center;gap:11px;background:none;border:none;cursor:pointer;padding:14px 16px;font-family:var(--sans);font-weight:600;font-size:15px;color:var(--ink)}
.bx-drop-badge{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:var(--ember-soft);color:var(--ember);font-size:13px}
.bx-drop-chev{margin-left:auto;color:var(--ink-3)}
.bx-drop-form{padding:0 16px 16px;border-top:1px solid var(--line)}
.bx-seg{display:inline-flex;gap:0;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:3px;margin:14px 0}
.bx-seg button{border:none;background:none;cursor:pointer;font-family:var(--sans);font-weight:600;font-size:13px;color:var(--ink-2);padding:7px 16px;border-radius:8px}
.bx-seg button.on{background:var(--surface);color:var(--ink);box-shadow:var(--shadow)}
.bx-field{margin-bottom:12px}
.bx-field label{display:block;font-size:12px;font-weight:600;color:var(--ink-2);margin-bottom:6px}
.bx-field input{width:100%;background:var(--surface-2);border:1px solid var(--line-2);border-radius:11px;padding:11px 13px;font:inherit;font-size:14px;color:var(--ink);outline:none}
.bx-field input:focus{border-color:var(--ember);box-shadow:0 0 0 3px var(--ember-soft)}
.bx-field input[type=file]{padding:9px 11px}
.bx-field-row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
.bx-drop-actions{display:flex;align-items:center;gap:12px;margin-top:8px}
.bx-progress{font-size:13px;color:var(--ink-3)}
.bx-dropnote{font-size:12px;color:var(--ink-3);text-align:center;margin-top:10px}

/* wallet */
.bx-balcard{background:linear-gradient(150deg,var(--ember),#7e2a19);border-radius:20px;padding:24px;color:#fff;box-shadow:var(--shadow);margin:18px 0 20px}
.bx-balcard .lab{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.82}
.bx-balcard .big{font-family:var(--serif);font-weight:600;font-size:clamp(40px,8vw,52px);line-height:1;margin:8px 0 4px;display:flex;align-items:baseline;gap:9px}
.bx-balcard .big span{font-family:var(--mono);font-size:15px;font-weight:400;opacity:.85}
.bx-balcard .eur{font-size:12.5px;opacity:.85}
.bx-ledlab{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin:0 2px 9px}
.bx-pkgs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:22px}
.bx-pkg{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:15px 8px;text-align:center;cursor:pointer;transition:border-color .15s,transform .05s;box-shadow:var(--shadow)}
.bx-pkg:hover{border-color:var(--gold)}
.bx-pkg:active{transform:scale(.98)}
.bx-pkg:disabled{opacity:.5;cursor:not-allowed}
.bx-pkg .tk{font-family:var(--mono);font-weight:500;font-size:17px;color:var(--gold)}
.bx-pkg .pr{font-size:11.5px;color:var(--ink-3);margin-top:3px}
.bx-pkg .lb{font-size:10px;color:var(--ink-3);margin-top:5px;text-transform:uppercase;letter-spacing:.08em}
.bx-led{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:var(--shadow)}
.bx-led .r{display:flex;align-items:center;gap:10px;padding:12px 15px;border-bottom:1px solid var(--line);font-size:13px}
.bx-led .r:last-child{border-bottom:none}
.bx-led .r .d{color:var(--ink-2);flex:1;min-width:0}
.bx-led .r .d small{display:block;color:var(--ink-3);font-size:11px;font-family:var(--mono);margin-top:1px}
.bx-led .r .a{font-family:var(--mono);font-weight:500;flex:none}
.bx-led .r .a.pos{color:var(--ok)}
.bx-led .r .a.neg{color:var(--ink-2)}
.bx-led .r .bal{font-family:var(--mono);font-size:11px;color:var(--ink-3);flex:none;width:64px;text-align:right}

/* bottom tab nav */
.bx-nav{position:fixed;left:0;right:0;bottom:0;z-index:45;background:color-mix(in srgb,var(--surface) 90%,transparent);
  backdrop-filter:blur(16px);border-top:1px solid var(--line)}
.bx-nav-inner{max-width:520px;margin:0 auto;display:flex}
.bx-nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  padding:9px 4px calc(9px + env(safe-area-inset-bottom));text-decoration:none;color:var(--ink-3);font-size:10.5px;font-weight:600;
  font-family:var(--sans);transition:color .15s}
.bx-nav-btn svg{width:22px;height:22px}
.bx-nav-btn:hover{color:var(--ink-2)}
.bx-nav-btn.on{color:var(--ember)}

/* cart */
.bx-cart{position:fixed;left:50%;bottom:80px;transform:translate(-50%,220%);width:min(560px,calc(100% - 36px));
  background:var(--ink);color:var(--surface);border-radius:16px;padding:12px 16px;display:flex;align-items:center;gap:14px;
  box-shadow:0 18px 44px -14px rgba(0,0,0,.6);transition:transform .3s cubic-bezier(.2,.8,.2,1);z-index:40}
.bx-cart.show{transform:translate(-50%,0)}
.bx-cart .info{font-size:12.5px;line-height:1.25}
.bx-cart .info b{font-family:var(--mono);font-size:16px;display:block;color:var(--gold)}
.bx-cart .cnt{font-size:11px;opacity:.7}
.bx-cart .bx-btn{margin-left:auto}

/* toast */
.bx-toast{position:fixed;left:50%;bottom:150px;transform:translate(-50%,20px);opacity:0;pointer-events:none;
  background:var(--ink);color:var(--surface);font-size:13px;font-weight:500;padding:11px 18px;border-radius:12px;
  box-shadow:var(--shadow);transition:.25s;max-width:86%;text-align:center;z-index:50}
.bx-toast.show{opacity:1;transform:translate(-50%,0)}

@media(prefers-reduced-motion:reduce){.boxui *{transition:none!important}.bx-card:hover{transform:none}}
`;
