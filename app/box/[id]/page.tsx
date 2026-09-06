'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type FeedItem = {
  public_id: string;
  title: string;
  description: string | null;
  price_tokens: number;
  creator: string | null;
  is_owner?: boolean;
  asset_count: number;
  media_type: 'image' | 'video';
  preview_url: string | null;
};
type Ctx = { canUpload: boolean; boxName: string };

function fmtCountdown(iso: string): string {
  let s = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

// Deterministic gradient + avatar colour so a given creator/drop always looks the same.
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
function gradOf(s: string) { return GRADS[hash(s) % GRADS.length]; }
function avColorOf(s: string) { return AV_COLORS[hash(s) % AV_COLORS.length]; }

const PhotoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M4 18l5-4 3 2 4-4 4 4" /></svg>
);
const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" /></svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4.5" y="10" width="15" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);

export default function BoxPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const boxId = params.id;
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [rented, setRented] = useState<Record<string, string>>({}); // content_public_id -> expires_at
  const [ctx, setCtx] = useState<Ctx>({ canUpload: false, boxName: boxId });
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [renting, setRenting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast((t) => (t === m ? null : t)), 2400); }, []);

  const loadWallet = useCallback(async () => {
    const w = await fetch('/api/wallet');
    if (w.ok) setBalance((await w.json()).balance ?? null);
  }, []);

  const loadFeed = useCallback(async () => {
    const [f, m] = await Promise.all([fetch(`/api/boxes/${boxId}/feed`), fetch('/api/rentals/my')]);
    if (f.status === 401) { router.push(`/login?next=/box/${boxId}`); return; }
    if (f.ok) setFeed((await f.json()).feed || []);
    if (m.ok) {
      const map: Record<string, string> = {};
      for (const r of (await m.json()).rentals || []) map[r.content_public_id] = r.expires_at;
      setRented(map);
    }
  }, [boxId, router]);

  useEffect(() => {
    (async () => {
      const [meRes, boxRes] = await Promise.all([fetch('/api/me'), fetch(`/api/boxes/${boxId}`)]);
      if (meRes.status === 401) { router.push(`/login?next=/box/${boxId}`); return; }
      const me = await meRes.json();
      const box = boxRes.ok ? (await boxRes.json()).box : null;
      const isOperator = !!me.roles?.some((r: { role: string }) => r.role === 'platform_operator');
      setCtx({ canUpload: isOperator || box?.role === 'creator' || box?.role === 'box_admin', boxName: box?.name || boxId });
      await Promise.all([loadFeed(), loadWallet()]);
      setLoading(false);
    })();
  }, [boxId, router, loadFeed, loadWallet]);

  const isRentedNow = useCallback((id: string) => {
    const e = rented[id];
    return !!e && new Date(e).getTime() > Date.now();
  }, [rented]);

  const toggle = useCallback((id: string) => setSelected((s) => ({ ...s, [id]: !s[id] })), []);

  // Rent one or many, sequentially, through the per-item endpoint. Shared by the
  // card's "Rent 24u" button and the cart's batch action.
  const rent = useCallback(async (ids: string[]) => {
    if (!ids.length || renting) return;
    setRenting(true);
    let ok = 0; let failMsg: string | null = null;
    for (const id of ids) {
      try {
        const r = await fetch(`/api/content/${id}/rent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idempotencyKey: `${id}:${Date.now()}` }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Could not rent');
        setRented((m) => ({ ...m, [id]: j.expiresAt }));
        setSelected((s) => { const n = { ...s }; delete n[id]; return n; });
        ok++;
      } catch (e) { failMsg = (e as Error).message; break; }
    }
    await loadWallet();
    setRenting(false);
    if (ok) flash(ok > 1 ? `${ok} items gehuurd · 24u toegang` : 'Gehuurd · 24u toegang actief');
    if (failMsg) flash(failMsg);
  }, [renting, loadWallet, flash]);

  if (loading) return <div className="boxui"><style>{boxCss}</style><p className="bx-loading">Loading…</p></div>;

  const creators = new Set(feed.map((f) => f.creator).filter(Boolean)).size;
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const cartTotal = selectedIds.reduce((s, id) => s + (feed.find((f) => f.public_id === id)?.price_tokens || 0), 0);

  return (
    <div className="boxui">
      <style>{boxCss}</style>

      {/* top bar */}
      <header className="bx-top">
        <div className="bx-badge">✦</div>
        <div className="bx-titles">
          <div className="bx-name">{ctx.boxName}</div>
          <div className="bx-sub">{creators || '—'} creator{creators === 1 ? '' : 's'} · besloten box</div>
        </div>
        <a href="/rentals" className="bx-chip alt" title="My rentals">◷ Rentals</a>
        <a href="/app" className="bx-chip alt" title="Dashboard">↩ Dashboard</a>
        <a href="/wallet" className="bx-chip wallet" title="Wallet">◈ {balance ?? '—'}</a>
      </header>

      {ctx.canUpload && <Upload boxId={boxId} onUploaded={loadFeed} />}

      <div className="bx-vhead">
        <h2>Discover</h2>
        <span className="bx-cnt">{feed.length} drop{feed.length === 1 ? '' : 's'}</span>
      </div>

      {feed.length === 0 ? (
        <div className="bx-empty">
          <PhotoIcon />
          <div className="h">Nog geen content</div>
          <p>{ctx.canUpload ? 'Drop hierboven iets om te beginnen.' : 'Kom later terug — creators droppen binnenkort.'}</p>
        </div>
      ) : (
        <div className="bx-grid">
          {feed.map((c) => (
            <BxCard
              key={c.public_id}
              item={c}
              expiry={rented[c.public_id] || null}
              rentedNow={isRentedNow(c.public_id)}
              selected={!!selected[c.public_id]}
              onToggle={() => toggle(c.public_id)}
              onRent={() => rent([c.public_id])}
              renting={renting}
              onReported={() => flash('Gerapporteerd — bedankt. Ons team bekijkt het.')}
            />
          ))}
        </div>
      )}

      {/* cart bar */}
      <div className={`bx-cart ${selectedIds.length ? 'show' : ''}`}>
        <div className="info">Rent selected<b>{cartTotal} tokens</b></div>
        <div className="cnt">{selectedIds.length} item{selectedIds.length === 1 ? '' : 's'}</div>
        <button className="bx-btn ember" disabled={renting} onClick={() => rent(selectedIds)}>{renting ? '…' : 'Rent 24u'}</button>
      </div>

      <div className={`bx-toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}

function BxCard({ item, expiry, rentedNow, selected, onToggle, onRent, renting, onReported }: {
  item: FeedItem;
  expiry: string | null;
  rentedNow: boolean;
  selected: boolean;
  onToggle: () => void;
  onRent: () => void;
  renting: boolean;
  onReported: () => void;
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
  const canOpen = unlocked;

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
  const showBlur = !url && !unlocked; // locked preview stays blurred until rented+opened

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
          <span>{item.media_type === 'video' ? 'video' : `${item.asset_count} foto${item.asset_count === 1 ? '' : "'s"}`}</span>
          <span>24u toegang</span>
        </div>
        <div className="bx-buyrow">
          <span className="bx-price">◈ {item.price_tokens}</span>
          {canOpen
            ? <button className="bx-btn ember" onClick={view} disabled={busy}>{busy ? '…' : url ? 'Refresh' : 'Bekijk'}</button>
            : <button className="bx-btn ember" onClick={onRent} disabled={renting}>{renting ? '…' : 'Rent 24u'}</button>}
        </div>
        {err && <div className="bx-err">{err}</div>}
        {!owner && <button onClick={report} className="bx-report">⚑ Rapporteer</button>}
      </div>
    </div>
  );
}

function Upload({ boxId, onUploaded }: { boxId: string; onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('250');
  const [file, setFile] = useState<File | null>(null);       // image, or video poster
  const [video, setVideo] = useState<File | null>(null);     // video master
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);

  function reset() {
    setTitle(''); setFile(null); setVideo(null); setProgress(null);
    (['file', 'poster', 'video'] as const).forEach((k) => {
      const el = document.getElementById(`${k}-${boxId}`) as HTMLInputElement | null;
      if (el) el.value = '';
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || (mode === 'video' && !video)) return;
    setBusy(true); setMsg(null); setProgress(null);
    try {
      const fd = new FormData();
      fd.set('boxId', boxId); fd.set('title', title); fd.set('price', price);

      if (mode === 'video' && video) {
        setProgress('Upload voorbereiden…');
        const u = await fetch('/api/content/video-upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boxId, contentType: video.type }),
        });
        const uj = await u.json();
        if (!u.ok) throw new Error(uj.error || 'Could not start video upload');
        setProgress('Video uploaden…');
        const put = await fetch(uj.uploadUrl, { method: 'PUT', headers: { 'Content-Type': video.type }, body: video });
        if (!put.ok) throw new Error('Video upload failed');
        fd.set('videoPath', uj.path); fd.set('videoMime', video.type); fd.set('poster', file);
        setProgress('Afronden…');
      } else {
        fd.set('file', file);
      }

      const r = await fetch('/api/content', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Upload failed');
      setMsg({ kind: 'ok', text: `Gepost ${j.content.public_id}${j.content.status === 'pending' ? ' (in review)' : ''}` });
      reset();
      onUploaded();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); setProgress(null); }
  }

  return (
    <div className="bx-drop">
      <button type="button" className="bx-drop-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="bx-drop-badge">▲</span>
        <span>Drop content</span>
        <span className="bx-drop-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="bx-drop-form">
          <div className="bx-seg">
            <button type="button" className={mode === 'image' ? 'on' : ''} onClick={() => setMode('image')}>Foto</button>
            <button type="button" className={mode === 'video' ? 'on' : ''} onClick={() => setMode('video')}>Video</button>
          </div>

          {mode === 'image' ? (
            <div className="bx-field">
              <label htmlFor={`file-${boxId}`}>Afbeelding (JPEG / PNG / WebP, max 15MB)</label>
              <input id={`file-${boxId}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          ) : (
            <>
              <div className="bx-field">
                <label htmlFor={`video-${boxId}`}>Video (MP4 / WebM / MOV, max 100MB)</label>
                <input id={`video-${boxId}`} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
              </div>
              <div className="bx-field">
                <label htmlFor={`poster-${boxId}`}>Poster (blurred als preview, max 15MB)</label>
                <input id={`poster-${boxId}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </>
          )}

          <div className="bx-field-row">
            <div className="bx-field" style={{ flex: '1 1 200px' }}>
              <label htmlFor={`t-${boxId}`}>Titel</label>
              <input id={`t-${boxId}`} placeholder="Nairobi Weekend" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="bx-field" style={{ flex: '0 0 140px' }}>
              <label htmlFor={`pr-${boxId}`}>Prijs (tokens)</label>
              <input id={`pr-${boxId}`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>

          <div className="bx-drop-actions">
            <button className="bx-btn ember block" disabled={busy || !title || !file || (mode === 'video' && !video)}>{busy ? 'Bezig…' : '▲ Post naar Box'}</button>
            {progress && <span className="bx-progress">{progress}</span>}
          </div>
          <div className="bx-dropnote">Standaard blurred &amp; niet-gepubliceerd tot screening klaar is.</div>
          {msg && <div className={msg.kind === 'ok' ? 'bx-ok' : 'bx-err'}>{msg.text}</div>}
        </form>
      )}
    </div>
  );
}

const boxCss = `
.boxui{max-width:940px;margin:0 auto;padding:22px 18px 120px;position:relative}
.boxui .bx-loading{color:var(--ink-3);padding:40px 4px}

/* top bar */
.bx-top{display:flex;align-items:center;gap:11px;padding:6px 2px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.bx-badge{width:44px;height:44px;border-radius:13px;flex:none;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,var(--ember),#8f2f1c);color:#fff;font-size:21px;box-shadow:0 6px 16px -6px var(--ember)}
.bx-titles{min-width:0}
.bx-name{font-family:var(--serif);font-weight:600;font-size:22px;line-height:1.1;letter-spacing:-.01em}
.bx-sub{font-size:12px;color:var(--ink-3)}
.bx-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:8px 13px;font-family:var(--mono);
  font-size:13px;font-weight:500;text-decoration:none;cursor:pointer;border:1px solid var(--line-2);background:var(--surface-2);color:var(--ink-2);transition:border-color .15s,color .15s}
.bx-chip:hover{border-color:var(--ink-3);color:var(--ink)}
.bx-chip.alt{margin-left:0}
.bx-chip.wallet{margin-left:auto;background:rgba(169,118,42,.12);color:var(--gold);border-color:transparent;font-weight:600}
@media(max-width:560px){.bx-chip.wallet{margin-left:0}.bx-top{gap:8px}}

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
.bx-meta{font-size:12px;color:var(--ink-3);display:flex;gap:12px;margin-bottom:12px}
.bx-buyrow{display:flex;align-items:center;gap:10px}
.bx-price{font-family:var(--mono);font-weight:500;font-size:15px;color:var(--gold);display:inline-flex;align-items:center;gap:5px}
.bx-btn{border:none;cursor:pointer;font-family:var(--sans);font-weight:600;font-size:13.5px;border-radius:11px;padding:10px 15px;transition:filter .15s,transform .05s;color:#fff;background:linear-gradient(135deg,var(--ember),var(--ember-d))}
.bx-btn.ember{margin-left:auto}
.bx-btn:hover{filter:brightness(1.06)}
.bx-btn:active{transform:scale(.98)}
.bx-btn:disabled{opacity:.5;cursor:not-allowed}
.bx-btn.block{width:100%;margin-left:0;justify-content:center;display:flex;align-items:center;gap:8px}
.bx-err{font-size:12.5px;margin-top:8px;padding:8px 11px;border-radius:9px;background:rgba(228,106,88,.12);color:var(--bad)}
.bx-ok{font-size:12.5px;margin-top:8px;padding:8px 11px;border-radius:9px;background:rgba(84,181,129,.13);color:var(--ok)}
.bx-report{margin-top:8px;padding:4px 0;font-size:11px;background:none;border:none;color:var(--ink-3);cursor:pointer}
.bx-report:hover{color:var(--ink-2)}

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

/* cart */
.bx-cart{position:fixed;left:50%;bottom:22px;transform:translate(-50%,160%);width:min(560px,calc(100% - 36px));
  background:var(--ink);color:var(--surface);border-radius:16px;padding:12px 16px;display:flex;align-items:center;gap:14px;
  box-shadow:0 18px 44px -14px rgba(0,0,0,.6);transition:transform .3s cubic-bezier(.2,.8,.2,1);z-index:40}
.bx-cart.show{transform:translate(-50%,0)}
.bx-cart .info{font-size:12.5px;line-height:1.25}
.bx-cart .info b{font-family:var(--mono);font-size:16px;display:block;color:var(--gold)}
.bx-cart .cnt{font-size:11px;opacity:.7}
.bx-cart .bx-btn{margin-left:auto}

/* toast */
.bx-toast{position:fixed;left:50%;bottom:96px;transform:translate(-50%,20px);opacity:0;pointer-events:none;
  background:var(--ink);color:var(--surface);font-size:13px;font-weight:500;padding:11px 18px;border-radius:12px;
  box-shadow:var(--shadow);transition:.25s;max-width:86%;text-align:center;z-index:50}
.bx-toast.show{opacity:1;transform:translate(-50%,0)}

@media(prefers-reduced-motion:reduce){.boxui *{transition:none!important}.bx-card:hover{transform:none}}
`;
