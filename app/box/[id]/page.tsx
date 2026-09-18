'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { boxCss, FeedCard, PhotoIcon, BottomNav, type FeedItem } from '@/app/box-ui';
import { useT, LocaleSwitcher } from '@/app/i18n-provider';

type Ctx = { canUpload: boolean; boxName: string };

export default function BoxPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const t = useT();
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
        if (!r.ok) throw new Error(j.error || t('discover.errRent'));
        setRented((m) => ({ ...m, [id]: j.expiresAt }));
        setSelected((s) => { const n = { ...s }; delete n[id]; return n; });
        ok++;
      } catch (e) { failMsg = (e as Error).message; break; }
    }
    await loadWallet();
    setRenting(false);
    if (ok) flash(ok > 1 ? t('discover.rentedMany', { count: ok }) : t('discover.rentedOne'));
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
          <div className="bx-sub">{creators === 1 ? t('box.creatorOne') : t('box.creators', { count: creators || '—' })}</div>
        </div>
        <a href="/rentals" className="bx-chip" title={t('rentals.title')}>◷ {t('nav.rentals')}</a>
        <a href="/app" className="bx-chip" title={t('nav.dashboard')}>↩ {t('nav.dashboard')}</a>
        <a href="/wallet" className="bx-chip wallet" title={t('nav.wallet')}>◈ {balance ?? '—'}</a>
        <LocaleSwitcher compact />
      </header>

      {ctx.canUpload && <Upload boxId={boxId} onUploaded={loadFeed} />}

      <div className="bx-vhead">
        <h2>{t('discover.title')}</h2>
        <span className="bx-cnt">{feed.length === 1 ? t('discover.dropOne') : t('discover.drops', { count: feed.length })}</span>
      </div>

      {feed.length === 0 ? (
        <div className="bx-empty">
          <PhotoIcon />
          <div className="h">{t('box.emptyTitle')}</div>
          <p>{ctx.canUpload ? t('box.emptyUploader') : t('box.emptyMember')}</p>
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
              onReported={() => flash(t('discover.reported'))}
              showReport
            />
          ))}
        </div>
      )}

      <div className={`bx-cart ${selectedIds.length ? 'show' : ''}`}>
        <div className="info">{t('discover.rentSelected')}<b>{cartTotal} {t('wallet.tokens')}</b></div>
        <div className="cnt">{selectedIds.length === 1 ? t('discover.itemOne') : t('discover.items', { count: selectedIds.length })}</div>
        <button className="bx-btn ember" disabled={renting} onClick={() => rent(selectedIds)}>{renting ? '…' : t('feed.rent24')}</button>
      </div>

      <div className={`bx-toast ${toast ? 'show' : ''}`}>{toast}</div>
      <BottomNav />
    </div>
  );
}

function Upload({ boxId, onUploaded }: { boxId: string; onUploaded: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('250');
  const [file, setFile] = useState<File | null>(null);       // cover image, or video poster
  const [extra, setExtra] = useState<File[]>([]);            // further photos, uploaded direct to storage
  const [video, setVideo] = useState<File | null>(null);     // video master
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);

  function reset() {
    setTitle(''); setFile(null); setVideo(null); setExtra([]); setProgress(null);
    (['file', 'poster', 'video', 'extra'] as const).forEach((k) => {
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
        setProgress(t('box.prepUpload'));
        const u = await fetch('/api/content/video-upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boxId, contentType: video.type }),
        });
        const uj = await u.json();
        if (!u.ok) throw new Error(uj.error || t('box.errStartVideo'));
        setProgress(t('box.uploadingVideo'));
        const put = await fetch(uj.uploadUrl, { method: 'PUT', headers: { 'Content-Type': video.type }, body: video });
        if (!put.ok) throw new Error(t('box.errVideoUpload'));
        fd.set('videoPath', uj.path); fd.set('videoMime', video.type); fd.set('poster', file);
        setProgress(t('box.finishing'));
      } else {
        fd.set('file', file);
        // Extra photos go straight to storage: a request body is capped at ~4.5MB, so
        // several phone photos cannot ride along in this POST. Only their paths do.
        if (extra.length > 0) {
          const paths: string[] = [];
          for (let i = 0; i < extra.length; i++) {
            setProgress(`Foto ${i + 2}/${extra.length + 1} uploaden…`);
            const u = await fetch('/api/content/video-upload-url', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ boxId, contentType: extra[i].type }),
            });
            const uj = await u.json();
            if (!u.ok) throw new Error(uj.error || t('box.errStartPhoto'));
            const put = await fetch(uj.uploadUrl, { method: 'PUT', headers: { 'Content-Type': extra[i].type }, body: extra[i] });
            if (!put.ok) throw new Error(`Foto ${i + 2} upload failed`);
            paths.push(uj.path);
          }
          fd.set('imagePaths', JSON.stringify(paths));
          setProgress(t('box.finishing'));
        }
      }

      const r = await fetch('/api/content', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t('box.errUpload'));
      setMsg({ kind: 'ok', text: t('box.posted', { id: j.content.public_id })
        + (j.content.photos > 1 ? t('box.postedPhotos', { count: j.content.photos }) : '')
        + (j.content.status === 'pending' ? t('box.postedPending') : '') });
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
        <span>{t('box.dropContent')}</span>
        <span className="bx-drop-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="bx-drop-form">
          <div className="bx-seg">
            <button type="button" className={mode === 'image' ? 'on' : ''} onClick={() => setMode('image')}>{t('box.photo')}</button>
            <button type="button" className={mode === 'video' ? 'on' : ''} onClick={() => setMode('video')}>{t('box.video')}</button>
          </div>

          {mode === 'image' ? (
            <div className="bx-field">
              <label htmlFor={`file-${boxId}`}>{t('box.imageLabel')}</label>
              <input id={`file-${boxId}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <label htmlFor={`extra-${boxId}`}>{t('box.extraLabel')}</label>
              <input
                id={`extra-${boxId}`} type="file" multiple accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setExtra(Array.from(e.target.files ?? []).slice(0, 9))}
              />
              {extra.length > 0 && <p className="bx-hint">{t('box.extraHint', { count: extra.length + 1 })}</p>}
            </div>
          ) : (
            <>
              <div className="bx-field">
                <label htmlFor={`video-${boxId}`}>{t('box.videoLabel')}</label>
                <input id={`video-${boxId}`} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
              </div>
              <div className="bx-field">
                <label htmlFor={`poster-${boxId}`}>{t('box.posterLabel')}</label>
                <input id={`poster-${boxId}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </>
          )}

          <div className="bx-field-row">
            <div className="bx-field" style={{ flex: '1 1 200px' }}>
              <label htmlFor={`t-${boxId}`}>{t('box.titleLabel')}</label>
              <input id={`t-${boxId}`} placeholder="Nairobi Weekend" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="bx-field" style={{ flex: '0 0 140px' }}>
              <label htmlFor={`pr-${boxId}`}>{t('box.priceLabel')}</label>
              <input id={`pr-${boxId}`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>

          <div className="bx-drop-actions">
            <button className="bx-btn ember block" disabled={busy || !title || !file || (mode === 'video' && !video)}>{busy ? t('box.posting') : `▲ ${t('box.postToBox')}`}</button>
            {progress && <span className="bx-progress">{progress}</span>}
          </div>
          <div className="bx-dropnote">{t('box.dropNote')}</div>
          {msg && <div className={msg.kind === 'ok' ? 'bx-ok' : 'bx-err'}>{msg.text}</div>}
        </form>
      )}
    </div>
  );
}
