'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PACKAGES } from '@/lib/packages';
import { boxCss, BottomNav } from '@/app/box-ui';

type Me = { account: { public_id: string; status: string; email: string | null }; roles: { role: string; box_id: string | null }[] };
// adminCount = active box_admins who are not platform operators. Sent to operators
// only; undefined for everyone else, which is why the badge below tests for === 0.
type Box = { public_id: string; name: string; description: string | null; status: string; role?: string; adminCount?: number };

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);

  const isOperator = !!me?.roles.some((r) => r.role === 'platform_operator');
  const isCreator = !!me?.roles.some((r) => r.role === 'creator');
  const canAdmin = (b: Box) => isOperator || b.role === 'box_admin';

  const loadBoxes = useCallback(async () => {
    const r = await fetch('/api/boxes');
    if (r.ok) setBoxes((await r.json()).boxes || []);
  }, []);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/me');
      if (r.status === 401) { router.push('/login?next=/app'); return; }
      setMe(await r.json());
      await loadBoxes();
      setLoading(false);
    })();
  }, [router, loadBoxes]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // App Admin / box admin: rename a box in place.
  async function renameBox(b: Box) {
    const name = window.prompt('Edit group name', b.name);
    if (name == null) return;
    if (!name.trim() || name.trim() === b.name) return;
    const r = await fetch(`/api/boxes/${b.public_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (r.ok) {
      const j = await r.json();
      setBoxes((prev) => prev.map((x) => (x.public_id === b.public_id ? { ...x, name: j.box.name } : x)));
    } else {
      alert((await r.json()).error || 'Rename failed');
    }
  }

  if (loading) return <div className="container"><p className="dim">Loading…</p></div>;

  return (
    <div className="container" style={{ paddingBottom: 120 }}>
      <style>{boxCss}</style>
      <div className="between">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 style={{ marginBottom: 2 }}><span className="mono" style={{ fontSize: 22 }}>{me?.account.public_id}</span></h1>
          <div className="row" style={{ marginTop: 6 }}>
            {me?.roles.length ? me.roles.map((r, i) => (
              <span key={i} className="pill">{r.role}{r.box_id ? ' · box' : ''}</span>
            )) : <span className="dim">No roles yet</span>}
          </div>
        </div>
        <div className="row">
          <a href="/discover"><button className="ghost sm">✦ Discover</button></a>
          <a href="/rentals"><button className="ghost sm">My rentals</button></a>
          <a href="/account/password"><button className="ghost sm">🔑 Password</button></a>
          {(isOperator || me?.roles.some((r) => r.role === 'moderator')) && (
            <a href="/moderation"><button className="ghost sm">🛡 Moderation</button></a>
          )}
          {isOperator && (
            <a href="/admin"><button className="ghost sm">◈ Admin console</button></a>
          )}
          <button className="ghost sm" onClick={logout}>Sign out</button>
        </div>
      </div>

      <Wallet />

      {isCreator && <Verification />}

      {isCreator && <Earnings />}

      <AccountSettings initialEmail={me?.account.email ?? null} />

      {(isOperator || isCreator) && <CreateBox onCreated={loadBoxes} canMakeAdmin={isOperator} />}

      <h2 style={{ marginTop: 26 }}>Your boxes</h2>
      {boxes.length === 0 ? (
        <div className="card"><p className="dim" style={{ margin: 0 }}>No boxes yet.{isOperator || isCreator ? ' Create one above.' : ' You’ll see a box here once you’re invited to one.'}</p></div>
      ) : (
        boxes.map((b) => (
          <div className="card" key={b.public_id}>
            <div className="between">
              <div>
                <strong>{b.name}</strong> {b.role && <span className="tag">· {b.role}</span>}
                {b.adminCount === 0 && (
                  <span className="tag" style={{ color: 'var(--warn, #e0a94a)' }}> · no admin yet</span>
                )}
                <div className="dim"><span className="mono">{b.public_id}</span>{b.description ? ` — ${b.description}` : ''}</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {canAdmin(b) && <button className="ghost sm" onClick={() => renameBox(b)}>Edit name</button>}
                <a href={`/box/${b.public_id}`}><button className="ghost sm">Open feed →</button></a>
              </div>
            </div>
            {canAdmin(b) && (
              <Invite boxId={b.public_id} boxName={b.name} canMakeAdmin={isOperator} defaultRole={b.adminCount === 0 ? 'box_admin' : 'creator'} />
            )}
          </div>
        ))
      )}
      <BottomNav />
    </div>
  );
}

type Ledger = { type: string; amount_tokens: number; ref_id: string | null; balance_after: number; created_at: string };

function Wallet() {
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [amount, setAmount] = useState('1000');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [pspOff, setPspOff] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/wallet');
    if (r.ok) { const j = await r.json(); setBalance(j.balance); setLedger(j.ledger || []); }
  }, []);

  useEffect(() => {
    load();
    // Verotel redirects back with ?status=success|cancel (set in the PSP panel).
    const status = new URLSearchParams(window.location.search).get('status');
    if (status === 'success') { setOpen(true); setNotice({ kind: 'ok', text: 'Payment received — your tokens appear here once the payment is confirmed.' }); }
    if (status === 'cancel') { setOpen(true); setNotice({ kind: 'err', text: 'Payment canceled — no tokens were purchased.' }); }
  }, [load]);

  async function buy(packageId: string) {
    setBuyingId(packageId); setNotice(null); setPspOff(false);
    try {
      const r = await fetch('/api/wallet/purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      const j = await r.json();
      if (j?.configured === false) { setPspOff(true); return; } // PSP not set up yet → dev top-up fallback
      if (r.ok && j?.url) { window.location.href = j.url; return; } // → Verotel hosted payment page
      setNotice({ kind: 'err', text: j?.error || 'Could not start checkout' });
    } catch {
      setNotice({ kind: 'err', text: 'Network error — please try again' });
    } finally { setBuyingId(null); }
  }

  async function buyCrypto(packageId: string) {
    setBuyingId(packageId); setNotice(null); setPspOff(false);
    try {
      const r = await fetch('/api/wallet/purchase-crypto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      const j = await r.json();
      if (j?.configured === false) { setPspOff(true); return; } // crypto env not set → dev top-up fallback
      if (r.ok && j?.url) { window.location.href = j.url; return; } // → NOWPayments hosted checkout
      setNotice({ kind: 'err', text: j?.error || 'Could not start crypto checkout' });
    } catch {
      setNotice({ kind: 'err', text: 'Network error — please try again' });
    } finally { setBuyingId(null); }
  }

  async function topup() {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch('/api/wallet/topup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(amount) }) });
      const j = await r.json();
      if (r.ok) { setBalance(j.balance); load(); }
      else setNotice({ kind: 'err', text: j?.error || 'Top-up failed' });
    } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="between">
        <div>
          <div className="dim" style={{ fontWeight: 600 }}>Token wallet</div>
          <div style={{ fontSize: 30, fontFamily: 'ui-monospace,monospace', color: 'var(--teal)', fontWeight: 700 }}>
            ◈ {balance ?? '—'}
          </div>
          <div className="dim">≈ €{balance != null ? (balance / 100).toFixed(2) : '—'} · 100 tokens = €1</div>
        </div>
        <button className="sm" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : '＋ Buy tokens'}</button>
      </div>

      {open && (
        <>
          <hr />
          <div className="dim" style={{ fontWeight: 600 }}>Buy tokens</div>
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
            {PACKAGES.map((p) => (
              <div key={p.id} className="card" style={{ flex: '1 1 150px', margin: 0, textAlign: 'center' }}>
                <div style={{ fontWeight: 700 }}>{p.label}</div>
                <div className="mono" style={{ color: 'var(--teal)', fontSize: 20, fontWeight: 700, margin: '4px 0' }}>◈ {p.tokens}</div>
                <div className="dim" style={{ marginBottom: 10 }}>€{(p.eurCents / 100).toFixed(2)}</div>
                <button className="sm" style={{ width: '100%' }} disabled={buyingId !== null} onClick={() => buy(p.id)}>
                  {buyingId === p.id ? 'Starting…' : 'Buy'}
                </button>
                <button className="ghost sm" style={{ width: '100%', marginTop: 6 }} disabled={buyingId !== null} onClick={() => buyCrypto(p.id)}>
                  ◎ Pay with crypto
                </button>
              </div>
            ))}
          </div>

          {notice && <div className={`msg ${notice.kind}`} style={{ marginTop: 10 }}>{notice.text}</div>}

          {pspOff && (
            <>
              <div className="msg" style={{ marginTop: 10 }}>Card payments aren’t live yet. Use the dev top-up below to add test tokens.</div>
              <hr />
              <div className="dim" style={{ fontWeight: 600 }}>Dev top-up (pre-production only)</div>
              <div className="row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: '0 0 160px' }}>
                  <label htmlFor="topup">Tokens</label>
                  <input id="topup" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
                </div>
                <button className="sm" onClick={topup} disabled={busy || !amount}>{busy ? 'Adding…' : 'Add tokens'}</button>
              </div>
            </>
          )}

          {ledger.length > 0 && (
            <>
              <div className="dim" style={{ fontWeight: 600, margin: '14px 0 6px' }}>Ledger</div>
              <div style={{ fontSize: 13 }}>
                {ledger.slice(0, 12).map((e, i) => (
                  <div key={i} className="between" style={{ padding: '5px 0', borderTop: '1px solid var(--line)' }}>
                    <span className="dim">{e.type}{e.ref_id ? ` · ${e.ref_id}` : ''}</span>
                    <span className="mono" style={{ color: e.amount_tokens >= 0 ? 'var(--ok)' : 'var(--ink-2)' }}>
                      {e.amount_tokens >= 0 ? '+' : ''}{e.amount_tokens} → {e.balance_after}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

type Payout = { public_id: string; amount_tokens: number; eur_cents: number; status: string; note: string | null; requested_at: string; decided_at: string | null };
type EarningsData = { available_tokens: number; reserved_tokens: number; withdrawn_tokens: number; threshold_tokens: number; payouts: Payout[] };

function Earnings() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/payouts/me');
    if (r.ok) setData(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function request() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/payouts/request', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not request payout');
      setMsg({ kind: 'ok', text: `Payout ${j.payout.public_id} requested — an operator will review it.` });
      load();
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally { setBusy(false); }
  }

  if (!data) return null;
  const eur = (t: number) => `€${(t / 100).toFixed(2)}`;
  const pct = data.threshold_tokens > 0 ? Math.min(100, Math.round((data.available_tokens / data.threshold_tokens) * 100)) : 0;
  const canRequest = data.available_tokens >= data.threshold_tokens && data.available_tokens > 0;

  return (
    <div className="card">
      <div className="between">
        <div>
          <div className="dim" style={{ fontWeight: 600 }}>Creator earnings</div>
          <div style={{ fontSize: 30, fontFamily: 'ui-monospace,monospace', color: 'var(--ok)', fontWeight: 700 }}>◈ {data.available_tokens}</div>
          <div className="dim">{eur(data.available_tokens)} available · you keep 80% of each rental</div>
        </div>
        <button className="sm" onClick={request} disabled={busy || !canRequest}>
          {busy ? 'Requesting…' : 'Request payout'}
        </button>
      </div>

      {!canRequest && data.reserved_tokens === 0 && (
        <>
          <div style={{ height: 6, background: 'var(--line)', borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--ok)' }} />
          </div>
          <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>
            {eur(data.available_tokens)} of {eur(data.threshold_tokens)} minimum payout ({pct}%)
          </div>
        </>
      )}

      {data.reserved_tokens > 0 && (
        <div className="dim" style={{ marginTop: 8, fontSize: 13 }}>◷ {eur(data.reserved_tokens)} reserved in a pending request.</div>
      )}
      {data.withdrawn_tokens > 0 && (
        <div className="dim" style={{ fontSize: 13 }}>✓ {eur(data.withdrawn_tokens)} paid out to date.</div>
      )}

      {msg && <div className={`msg ${msg.kind}`} style={{ marginTop: 10 }}>{msg.text}</div>}

      {data.payouts.length > 0 && (
        <>
          <div className="dim" style={{ fontWeight: 600, margin: '14px 0 6px' }}>Payout history</div>
          <div style={{ fontSize: 13 }}>
            {data.payouts.map((p) => (
              <div key={p.public_id} className="between" style={{ padding: '5px 0', borderTop: '1px solid var(--line)' }}>
                <span className="dim"><span className="mono">{p.public_id}</span> · {new Date(p.requested_at).toLocaleDateString()}</span>
                <span className="row" style={{ gap: 8 }}>
                  <span className="mono">{eur(p.eur_cents)}</span>
                  <span className="tag">{p.status}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type VerificationState = { status: 'pending' | 'approved' | 'rejected'; rejection_reason: string | null; submitted_at: string } | null;

function Verification() {
  const [state, setState] = useState<VerificationState>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/verification');
    if (r.ok) setState((await r.json()).verification);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    fd.set('consent', (formEl.elements.namedItem('consent') as HTMLInputElement).checked ? 'true' : 'false');
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/verification', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not submit');
      setMsg({ kind: 'ok', text: 'Submitted — a reviewer will verify you shortly.' });
      load();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  if (!loaded) return null;

  if (state?.status === 'approved') {
    return (
      <div className="card" id="verification">
        <div className="dim" style={{ fontWeight: 600 }}>Identity</div>
        <div style={{ color: 'var(--ok)', fontWeight: 600, marginTop: 4 }}>✓ Verified (18+)</div>
        <div className="dim" style={{ fontSize: 13 }}>You can publish content.</div>
      </div>
    );
  }

  if (state?.status === 'pending') {
    return (
      <div className="card" id="verification">
        <div className="dim" style={{ fontWeight: 600 }}>Identity</div>
        <div style={{ fontWeight: 600, marginTop: 4 }}>◷ Under review</div>
        <div className="dim" style={{ fontSize: 13 }}>Your documents were submitted and are awaiting review. You’ll be notified of the decision.</div>
      </div>
    );
  }

  // Not submitted, or rejected → show the form.
  return (
    <form className="card" id="verification" onSubmit={submit}>
      <div className="dim" style={{ fontWeight: 600 }}>Verify your identity (18+)</div>
      <div className="dim" style={{ fontSize: 13, marginTop: 2 }}>Required before you can publish content. Your documents are stored privately and seen only by a reviewer.</div>
      {state?.status === 'rejected' && (
        <div className="msg err" style={{ marginTop: 10 }}>Previous submission declined{state.rejection_reason ? `: ${state.rejection_reason}` : ''}. Please resubmit.</div>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        <div>
          <label htmlFor="v-name">Full legal name</label>
          <input id="v-name" name="fullName" required placeholder="As shown on your ID" />
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="v-dob">Date of birth</label>
            <input id="v-dob" name="dob" type="date" required />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="v-country">Country (optional)</label>
            <input id="v-country" name="country" placeholder="BE" />
          </div>
        </div>
        <div>
          <label htmlFor="v-doctype">Document type</label>
          <select id="v-doctype" name="documentType" required defaultValue="passport">
            <option value="passport">Passport</option>
            <option value="id_card">ID card</option>
            <option value="drivers_license">Driver’s licence</option>
          </select>
        </div>
        <div>
          <label htmlFor="v-doc">ID document photo (max 2MB)</label>
          <input id="v-doc" name="document" type="file" accept="image/jpeg,image/png,image/webp" required />
        </div>
        <div>
          <label htmlFor="v-selfie">Selfie holding your ID (optional, max 2MB)</label>
          <input id="v-selfie" name="selfie" type="file" accept="image/jpeg,image/png,image/webp" />
        </div>
        <label className="row" style={{ gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
          <input type="checkbox" name="consent" required style={{ marginTop: 3 }} />
          <span className="dim">I confirm I am 18 or older, this is my own valid ID, and I consent to its processing for age/identity verification.</span>
        </label>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button disabled={busy}>{busy ? 'Submitting…' : 'Submit for verification'}</button>
      </div>
      {msg && <div className={`msg ${msg.kind}`} style={{ marginTop: 10 }}>{msg.text}</div>}
    </form>
  );
}

function AccountSettings({ initialEmail }: { initialEmail: string | null }) {
  const [email, setEmail] = useState(initialEmail ?? '');
  const [saved, setSaved] = useState(initialEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [open, setOpen] = useState(false);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/account/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not save');
      setSaved(j.email ?? '');
      setEmail(j.email ?? '');
      setMsg({ kind: 'ok', text: j.email ? 'Email saved.' : 'Email removed.' });
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="between">
        <div>
          <div className="dim" style={{ fontWeight: 600 }}>Account settings</div>
          <div className="dim" style={{ fontSize: 13 }}>{saved ? <>Notifications email: <span className="mono">{saved}</span></> : 'No notification email set'}</div>
        </div>
        <button className="ghost sm" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Edit'}</button>
      </div>

      {open && (
        <>
          <hr />
          <label htmlFor="acct-email">Contact email (optional)</label>
          <div className="dim" style={{ fontSize: 12, marginBottom: 6 }}>Used for notifications like payout decisions. Leave empty to remove. Your phone stays your login.</div>
          <div className="row" style={{ alignItems: 'flex-end', gap: 8 }}>
            <input id="acct-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1 }} />
            <button className="sm" onClick={save} disabled={busy || email === saved}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
          {msg && <div className={`msg ${msg.kind}`} style={{ marginTop: 10 }}>{msg.text}</div>}
        </>
      )}
    </div>
  );
}

// An operator can hand the new box straight to its admin: fill in a number and the
// box comes back with a one-time invite link for it. Link only — appointing an admin
// must not depend on a working SMS provider.
function CreateBox({ onCreated, canMakeAdmin }: { onCreated: () => void; canMakeAdmin: boolean }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [adminLink, setAdminLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copy() {
    if (!adminLink) return;
    try {
      await navigator.clipboard.writeText(adminLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg({ kind: 'err', text: 'Could not copy — select the link and copy it manually.' });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setAdminLink(null); setCopied(false);
    try {
      const r = await fetch('/api/boxes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc || null, adminPhone: canMakeAdmin ? adminPhone : undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not create box');
      setName(''); setDesc(''); setAdminPhone('');
      setAdminLink(j.adminInvite?.link ?? null);
      setMsg({
        kind: 'ok',
        text: j.adminInvite
          ? `Created ${j.box.public_id}. Send the admin link below — it works once, for that number only.`
          : `Created ${j.box.public_id}.`,
      });
      onCreated();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card">
      <h2>Create a box</h2>
      <label htmlFor="bn">Name</label>
      <input id="bn" placeholder="African Girls" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="bd">Description (optional)</label>
      <input id="bd" placeholder="A shared content room" value={desc} onChange={(e) => setDesc(e.target.value)} />
      {canMakeAdmin && (
        <>
          <label htmlFor="ba">Box admin phone (optional)</label>
          <input id="ba" placeholder="+31612345678" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
          <div className="dim" style={{ fontSize: 13 }}>
            Leave empty to run the box yourself. Fill it in and you get a one-time link to send them.
          </div>
        </>
      )}
      <div className="row" style={{ marginTop: 16 }}><button disabled={busy || !name}>{busy ? 'Creating…' : 'Create box'}</button></div>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
      {adminLink && (
        <div style={{ marginTop: 8 }}>
          <div className="row" style={{ alignItems: 'center', gap: 8 }}>
            <div className="dim" style={{ fontWeight: 600 }}>Box admin invite link</div>
            <button type="button" className="sm alt" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <code className="link">{adminLink}</code>
        </div>
      )}
    </form>
  );
}

// canMakeAdmin mirrors the server rule: only a platform operator may appoint a box
// admin, so a box admin never sees the option. The server enforces it regardless.
//
// The LINK is the invitation — a single-use, phone-bound, expiring token. SMS is just
// an envelope, so it is opt-in and never load-bearing: the inviter always gets the link
// back and can pass it on however they like.
type InviteRow = {
  public_id: string; target_role: string; created_at: string;
  expires_at: string; status: 'pending' | 'accepted' | 'expired' | 'revoked';
};

function Invite({ boxId, boxName, canMakeAdmin, defaultRole = 'creator' }: { boxId: string; boxName: string; canMakeAdmin: boolean; defaultRole?: string }) {
  const [phone, setPhone] = useState('');
  // A box with no admin yet opens on 'box admin', so handing it over is one field away
  // rather than a dropdown the operator has to remember to change.
  // Clamp: the 'box admin' option is not rendered for a non-operator, so seeding the
  // state with it would submit a role the server refuses with no way to change it.
  const [role, setRole] = useState(canMakeAdmin ? defaultRole : 'creator');
  const [alsoSms, setAlsoSms] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ role: string; phone: string; expiresAt: string | null } | null>(null);
  const [copied, setCopied] = useState<'message' | 'link' | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<InviteRow[]>([]);

  const loadRows = useCallback(async () => {
    const r = await fetch(`/api/boxes/${boxId}/invitations`);
    if (r.ok) setRows((await r.json()).invitations || []);
  }, [boxId]);
  useEffect(() => { loadRows(); }, [loadRows]);

  // What the admin pastes into WhatsApp or SMS themselves. A bare URL arrives as an
  // unexplained link from an unknown sender — easy to ignore, and it omits the one rule
  // that decides whether it works at all: the invitee must sign in with THAT number,
  // because acceptInvitation matches the token against their own verified phone.
  const inviteMessage = !link || !issued ? '' : [
    `You've been invited to "${boxName}" on Content24`,
    issued.role === 'creator' ? ' as a creator (you can post content).'
      : issued.role === 'box_admin' ? ' as an admin (you can run the box).'
      : ' as a member (you can buy and view content).',
    `\n\nOpen this link and sign in with this phone number (${issued.phone}) — it only works for you:\n`,
    link,
    issued.expiresAt ? `\n\nExpires ${new Date(issued.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.` : '',
  ].join('');

  async function copy(what: 'message' | 'link') {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(what === 'message' ? inviteMessage : link);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setMsg({ kind: 'err', text: 'Could not copy — select the text and copy it manually.' });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setLink(null); setIssued(null); setCopied(null);
    try {
      const r = await fetch(`/api/boxes/${boxId}/invitations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, role, sendSms: alsoSms }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not create invitation');
      setLink(j.link ?? null);
      setIssued({ role, phone, expiresAt: j.invitation?.expires_at ?? null });
      const sms = j.sms as { attempted: boolean; sent: boolean; detail?: string } | undefined;
      // Say what actually happened. Reporting "sent" on a failed send is what hid the
      // delivery problem: the invitation existed and nobody could reach it.
      const smsNote = !sms?.attempted
        ? 'Share the link below.'
        : sms.sent
          ? 'Also sent by SMS.'
          : `SMS failed (${sms.detail || 'no reason given'}) — share the link below.`;
      setMsg({ kind: sms?.attempted && !sms.sent ? 'err' : 'ok', text: `Invitation ${j.invitation.public_id} created (${role}). ${smsNote}` });
      setPhone('');
      await loadRows();
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    } finally { setBusy(false); }
  }

  async function revoke(publicId: string) {
    const r = await fetch(`/api/boxes/${boxId}/invitations/${publicId}/revoke`, { method: 'POST' });
    const j = await r.json();
    if (!r.ok) { setMsg({ kind: 'err', text: j.error || 'Could not revoke' }); return; }
    setMsg({ kind: 'ok', text: `Invitation ${publicId} revoked.` });
    await loadRows();
  }

  return (
    <>
      <hr />
      <form onSubmit={submit}>
        <div className="dim" style={{ fontWeight: 600 }}>Invite someone</div>
        <div className="row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor={`p-${boxId}`}>Phone (E.164)</label>
            <input id={`p-${boxId}`} placeholder="+31612345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div style={{ flex: '0 0 130px' }}>
            <label htmlFor={`r-${boxId}`}>Role</label>
            <select id={`r-${boxId}`} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="creator">creator</option>
              <option value="user">user</option>
              {canMakeAdmin && <option value="box_admin">box admin</option>}
            </select>
          </div>
          <button className="sm" disabled={busy || !phone}>{busy ? 'Creating…' : 'Create invite link'}</button>
        </div>
        <label htmlFor={`s-${boxId}`} className="dim" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontWeight: 400 }}>
          <input id={`s-${boxId}`} type="checkbox" checked={alsoSms} onChange={(e) => setAlsoSms(e.target.checked)} style={{ width: 'auto' }} />
          Also text the link to this number
        </label>
      </form>
      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}
      {link && (
        <div style={{ marginTop: 8 }}>
          <div className="dim" style={{ fontWeight: 600 }}>
            Invite link — valid once, for {issued?.phone ?? 'this number'} only
          </div>
          <div className="row" style={{ alignItems: 'center', gap: 8, marginTop: 6 }}>
            <button type="button" className="sm alt" onClick={() => copy('message')}>
              {copied === 'message' ? '✓ Copied' : 'Copy message'}
            </button>
            <button type="button" className="sm" onClick={() => copy('link')}>
              {copied === 'link' ? '✓ Copied' : 'Copy link only'}
            </button>
          </div>
          <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>
            Paste it into WhatsApp, SMS or Signal to {issued?.phone ?? 'them'}:
          </div>
          <pre className="link" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, marginTop: 4 }}>{inviteMessage}</pre>
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="dim" style={{ fontWeight: 600 }}>Invitations</div>
          {rows.map((i) => (
            <div key={i.public_id} className="row" style={{ alignItems: 'center', gap: 8, marginTop: 6 }}>
              <code style={{ flex: '1 1 auto' }}>{i.public_id}</code>
              <span className="dim">{i.target_role}</span>
              <span className="dim">{i.status}</span>
              {i.status === 'pending' && (
                <button type="button" className="sm" onClick={() => revoke(i.public_id)}>Revoke</button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
