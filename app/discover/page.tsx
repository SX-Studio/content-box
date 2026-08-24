'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Item = {
  public_id: string;
  title: string;
  price_tokens: number;
  creator: string | null;
  is_owner?: boolean;
  box_name: string;
  box_public_id: string;
  media_type: 'image' | 'video';
  preview_url: string | null;
};

function fmtCountdown(iso: string): string {
  let s = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

export default function DiscoverPage() {
  const router = useRouter();
  const [feed, setFeed] = useState<Item[]>([]);
  const [rented, setRented] = useState<Record<string, string>>({});
  const [box, setBox] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [f, m] = await Promise.all([fetch('/api/discover'), fetch('/api/rentals/my')]);
    if (f.status === 401) { router.push('/login?next=/discover'); return; }
    if (f.ok) setFeed((await f.json()).feed || []);
    if (m.ok) {
      const map: Record<string, string> = {};
      for (const r of (await m.json()).rentals || []) map[r.content_public_id] = r.expires_at;
      setRented(map);
    }
    setLoading(false);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="container"><p className="dim">Loading…</p></div>;

  const boxes = Array.from(new Map(feed.map((i) => [i.box_public_id, i.box_name])).entries());
  const shown = box === 'all' ? feed : feed.filter((i) => i.box_public_id === box);

  return (
    <div className="container">
      <div className="between">
        <div>
          <p className="eyebrow">Discover</p>
          <h1 style={{ marginBottom: 2 }}>One feed, every box</h1>
          <div className="dim">Newest content across the boxes you belong to.</div>
        </div>
        <a href="/app"><button className="ghost sm">← Dashboard</button></a>
      </div>

      {boxes.length > 1 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <button className={box === 'all' ? 'sm' : 'ghost sm'} onClick={() => setBox('all')}>All</button>
          {boxes.map(([id, name]) => (
            <button key={id} className={box === id ? 'sm' : 'ghost sm'} onClick={() => setBox(id)}>{name}</button>
          ))}
        </div>
      )}

      <div className="feed-grid" style={{ marginTop: 18 }}>
        {shown.length === 0
          ? <div className="card"><p className="dim" style={{ margin: 0 }}>Nothing here yet. Join a box or check back soon.</p></div>
          : shown.map((c) => <DiscoverCard key={c.public_id} item={c} initialExpiry={rented[c.public_id] || null} />)}
      </div>
    </div>
  );
}

function DiscoverCard({ item, initialExpiry }: { item: Item; initialExpiry: string | null }) {
  const [expiry, setExpiry] = useState<string | null>(initialExpiry);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!expiry) return;
    const iv = setInterval(() => {
      if (new Date(expiry).getTime() <= Date.now()) { setExpiry(null); setUrl(null); }
      else setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [expiry]);

  async function rent() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/content/${item.public_id}/rent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: `${item.public_id}:${Date.now()}` }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not rent');
      setExpiry(j.expiresAt);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function view() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/content/${item.public_id}/view`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not open');
      setUrl(j.url);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const owner = !!item.is_owner;
  const isRented = !!expiry;
  return (
    <div className="feed-card">
      <div className="feed-media">
        {url
          ? (item.media_type === 'video'
              ? <video src={url} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
              : <img src={url} alt={item.title} />)
          : item.preview_url
          ? <img src={item.preview_url} alt="" loading="lazy" />
          : <div className="feed-noimg" />}
        <div className="feed-lock">
          {owner ? <>✦ Your content</> : isRented ? <>🔓 Rented · <span className="cd">{fmtCountdown(expiry!)}</span></> : <>🔒 Blurred preview</>}
          {item.media_type === 'video' && !url && <> · ▶ video</>}
        </div>
      </div>
      <div className="feed-body">
        <strong>{item.title}</strong>
        <div className="dim"><a href={`/box/${item.box_public_id}`} style={{ color: 'inherit' }}>{item.box_name}</a> · {item.creator}</div>
        <div className="row between" style={{ marginTop: 8 }}>
          <span className="price">◈ {item.price_tokens}</span>
          {owner || isRented
            ? <button className="sm" onClick={view} disabled={busy}>{busy ? '…' : url ? 'Refresh' : 'View'}</button>
            : <button className="sm" onClick={rent} disabled={busy}>{busy ? '…' : 'Rent 24h'}</button>}
        </div>
        {err && <div className="msg err" style={{ marginTop: 8 }}>{err}</div>}
      </div>
    </div>
  );
}
