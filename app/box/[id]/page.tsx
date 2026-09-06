'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { boxCss, FeedCard, PhotoIcon, type FeedItem } from '@/app/box-ui';

type Ctx = { canUpload: boolean; boxName: string };

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

      <header className="bx-top">
        <div className="bx-badge">✦</div>
        <div className="bx-titles">
          <div className="bx-name">{ctx.boxName}</div>
          <div className="bx-sub">{creators || '—'} creator{creators === 1 ? '' : 's'} · besloten box</div>
        </div>
        <a href="/rentals" className="bx-chip" title="My rentals">◷ Rentals</a>
        <a href="/app" className="bx-chip" title="Dashboard">↩ Dashboard</a>
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
            <FeedCard
              key={c.public_id}
              item={c}
              expiry={rented[c.public_id] || null}
              rentedNow={isRentedNow(c.public_id)}
              selected={!!selected[c.public_id]}
              onToggle={() => toggle(c.public_id)}
              onRent={() => rent([c.public_id])}
              renting={renting}
              onReported={() => flash('Gerapporteerd — bedankt. Ons team bekijkt het.')}
              showReport
            />
          ))}
        </div>
      )}

      <div className={`bx-cart ${selectedIds.length ? 'show' : ''}`}>
        <div className="info">Rent selected<b>{cartTotal} tokens</b></div>
        <div className="cnt">{selectedIds.length} item{selectedIds.length === 1 ? '' : 's'}</div>
        <button className="bx-btn ember" disabled={renting} onClick={() => rent(selectedIds)}>{renting ? '…' : 'Rent 24u'}</button>
      </div>

      <div className={`bx-toast ${toast ? 'show' : ''}`}>{toast}</div>
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
