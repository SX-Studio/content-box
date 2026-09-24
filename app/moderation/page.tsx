'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminVerifications from '@/app/admin/AdminVerifications';

type Case = {
  status: string;
  risk_level: string;
  created_at: string;
  content: { public_id: string; title: string; status: string; creator: { public_id: string } | null; box: { public_id: string; name: string } | null } | null;
};
type Report = { public_id: string; target_type: string; target_id: string; reason: string; details: string | null; status: string; created_at: string };
type BoxRow = { public_id: string; name: string; status: string; created_at: string; contentCount: number; rentalCount: number };

const RISK_COLOR: Record<string, string> = { low: 'var(--ok)', uncertain: 'var(--warn, var(--warn))', high: 'var(--bad)' };

export default function ModerationPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'queue' | 'reports' | 'boxes' | 'verifications'>('queue');
  const [queue, setQueue] = useState<Case[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  // Boxes are operator-only, stricter than the rest of this console. A 403 here just
  // means 'moderator, not operator' — the tab hides, the console still works.
  const [isOperator, setIsOperator] = useState(false);
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');

  const load = useCallback(async () => {
    const q = await fetch('/api/moderation/queue');
    if (q.status === 401) { router.push('/login?next=/moderation'); return; }
    if (q.status === 403) { setState('denied'); return; }
    setQueue((await q.json()).queue || []);
    const r = await fetch('/api/moderation/reports');
    if (r.ok) setReports((await r.json()).reports || []);
    const b = await fetch('/api/moderation/boxes');
    if (b.ok) { setIsOperator(true); setBoxes((await b.json()).boxes || []); } else { setIsOperator(false); }
    setState('ok');
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function decide(contentId: string, action: string) {
    if ((action === 'delete' || action === 'suspend') && !confirm(`${action} ${contentId}?`)) return;
    const r = await fetch(`/api/moderation/${contentId}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    if (r.ok) load();
  }
  async function viewOriginal(contentId: string) {
    const r = await fetch(`/api/moderation/original/${contentId}`);
    if (r.ok) { const j = await r.json(); setUrls((u) => ({ ...u, [contentId]: j.url })); }
  }
  async function resolve(reportId: string, status: string) {
    const r = await fetch(`/api/moderation/reports/${reportId}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (r.ok) load();
  }

  // Removing a box is the one irreversible action in this console when the box is empty,
  // so it asks first — and the prompt names which of the two things will happen.
  async function remove(b: BoxRow, permanent: boolean) {
    const warning = permanent
      ? `Permanently delete "${b.name}"? It holds no content and no rentals, so this cannot be undone.`
      : `Archive "${b.name}"? It holds ${b.contentCount} content and ${b.rentalCount} rentals, so it will be hidden everywhere rather than deleted. You can restore it later.`;
    if (!window.confirm(warning)) return;
    const r = await fetch(`/api/boxes/${b.public_id}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { window.alert(j.error || 'Could not remove this box'); return; }
    load();
  }

  async function restore(b: BoxRow) {
    const r = await fetch(`/api/boxes/${b.public_id}/restore`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { window.alert(j.error || 'Could not restore this box'); return; }
    load();
  }

  if (state === 'loading') return <div className="container"><p className="dim">Loading…</p></div>;
  if (state === 'denied') return <div className="container"><h1>Moderation</h1><p className="muted">You don’t have moderator access.</p><a href="/app"><button className="ghost sm">← Dashboard</button></a></div>;

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <div className="between">
        <div><p className="eyebrow">Trust &amp; Safety</p><h1>Moderation console</h1></div>
        <a href="/app"><button className="ghost sm">← Dashboard</button></a>
      </div>

      <div className="row" style={{ margin: '10px 0 4px' }}>
        <button className={tab === 'queue' ? '' : 'ghost'} onClick={() => setTab('queue')}>Content ({queue.length})</button>
        <button className={tab === 'reports' ? '' : 'ghost'} onClick={() => setTab('reports')}>Reports ({reports.filter((r) => r.status === 'open').length})</button>
        <button className={tab === 'verifications' ? '' : 'ghost'} onClick={() => setTab('verifications')}>ID checks</button>
        {isOperator && <button className={tab === 'boxes' ? '' : 'ghost'} onClick={() => setTab('boxes')}>Boxes ({boxes.length})</button>}
      </div>

      {/* Creator 18+/ID approvals. This lived only in /admin, which sits behind a passkey
          step-up — and with no passkey enrolled, nobody could approve anyone, so no
          invited creator could ever publish. The two verification routes are role-gated
          (operator or moderator), exactly like this console, so the queue belongs here too. */}
      {tab === 'verifications' && <AdminVerifications />}

      {tab === 'queue' && (queue.length === 0 ? <div className="card"><p className="dim" style={{ margin: 0 }}>No content yet.</p></div> : queue.map((c) => (
        <div className="card" key={c.content?.public_id}>
          <div className="between">
            <div>
              <strong>{c.content?.title}</strong> <span className="pill">{c.content?.status}</span>{' '}
              <span className="pill" style={{ color: RISK_COLOR[c.risk_level] }}>risk: {c.risk_level}</span>
              <div className="dim mono" style={{ fontSize: 11 }}>{c.content?.public_id} · {c.content?.box?.name} · {c.content?.creator?.public_id}</div>
            </div>
          </div>
          {urls[c.content!.public_id] && <img src={urls[c.content!.public_id]} alt="" style={{ maxWidth: 220, borderRadius: 10, marginTop: 10, display: 'block' }} />}
          <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <button className="ghost sm" onClick={() => viewOriginal(c.content!.public_id)}>👁 View original (logged)</button>
            <button className="sm" style={{ background: 'var(--ok)' }} onClick={() => decide(c.content!.public_id, 'approve')}>Approve</button>
            <button className="sm" style={{ background: 'var(--warn,var(--warn))' }} onClick={() => decide(c.content!.public_id, 'suspend')}>Suspend</button>
            <button className="sm" style={{ background: 'var(--bad)' }} onClick={() => decide(c.content!.public_id, 'reject')}>Reject</button>
            <button className="sm ghost" onClick={() => decide(c.content!.public_id, 'delete')}>Delete</button>
          </div>
        </div>
      )))}

      {tab === 'reports' && (reports.length === 0 ? <div className="card"><p className="dim" style={{ margin: 0 }}>No reports.</p></div> : reports.map((r) => (
        <div className="card" key={r.public_id}>
          <div className="between">
            <div>
              <strong>{r.reason}</strong> <span className="pill">{r.status}</span>
              <div className="dim mono" style={{ fontSize: 11 }}>{r.public_id} · {r.target_type} {r.target_id}</div>
              {r.details && <div className="dim" style={{ fontSize: 13 }}>{r.details}</div>}
            </div>
          </div>
          {r.status === 'open' && (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="sm ghost" onClick={() => resolve(r.public_id, 'triaged')}>Triaged</button>
              <button className="sm" style={{ background: 'var(--bad)' }} onClick={() => resolve(r.public_id, 'actioned')}>Actioned</button>
              <button className="sm ghost" onClick={() => resolve(r.public_id, 'dismissed')}>Dismiss</button>
            </div>
          )}
        </div>
      )))}

      {tab === 'boxes' && (boxes.length === 0 ? <div className="card"><p className="dim" style={{ margin: 0 }}>No boxes.</p></div> : boxes.map((b) => {
        // What the button will actually do, decided the same way the server decides it.
        // Saying "Delete" on a box that will only be archived would be a lie.
        const willDelete = b.contentCount === 0 && b.rentalCount === 0;
        const archived = b.status === 'archived';
        return (
          <div className="card" key={b.public_id}>
            <div className="between">
              <div>
                <strong>{b.name}</strong> <span className="pill">{b.status}</span>
                <div className="dim mono" style={{ fontSize: 11 }}>{b.public_id}</div>
                <div className="dim" style={{ fontSize: 13 }}>
                  {b.contentCount} content · {b.rentalCount} rentals
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              {archived ? (
                <button className="sm ghost" onClick={() => restore(b)}>Restore</button>
              ) : willDelete ? (
                <button className="sm" style={{ background: 'var(--bad)' }} onClick={() => remove(b, true)}>Delete permanently</button>
              ) : (
                <button className="sm" style={{ background: 'var(--warn, #e0a94a)', color: '#05030c' }} onClick={() => remove(b, false)}>Archive</button>
              )}
            </div>
            {!archived && !willDelete && (
              <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>
                Holds rentals people paid for, so it archives instead of deleting. Archived boxes
                disappear from every feed and accept no uploads or rentals — and can be restored.
              </div>
            )}
          </div>
        );
      }))}
    </div>
  );
}
