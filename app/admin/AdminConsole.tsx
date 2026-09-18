'use client';
import { useState } from 'react';
import AdminBoxes, { type BoxStat } from './AdminBoxes';
import AdminTools from './AdminTools';
import AdminChat from './AdminChat';
import AdminSearch from './AdminSearch';
import AdminPayouts from './AdminPayouts';
import AdminEconomics from './AdminEconomics';
import AdminVerifications from './AdminVerifications';

export type Overview = {
  accounts: number; boxes: number; content: number; drops_last_hour: number;
  active_rentals: number; open_reports: number;
  tokens_in_circulation: number; creator_tokens: number; platform_tokens: number;
};
export type AuditRow = { ts: string; actor: string; action: string; target: string; meta: string };

type Tab = 'overview' | 'moderation' | 'users' | 'boxes' | 'finance' | 'audit';
const TITLES: Record<Tab, string> = {
  overview: 'Platform Overview', moderation: 'Content Moderation', users: 'Users & Creators',
  boxes: 'Boxes', finance: 'Finance & Payouts', audit: 'Audit Log',
};

const I = {
  overview: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
  moderation: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9.5 12l1.8 1.8L15 10" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.5-3.2 3-5 5.5-5s5 1.8 5.5 5" /><path d="M16 5.5a3 3 0 0 1 0 5.8M18 20c-.2-2.2-1-3.8-2.4-4.7" /></svg>,
  boxes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 8l9-4 9 4-9 4-9-4z" /><path d="M3 8v8l9 4 9-4V8" /><path d="M12 12v8" /></svg>,
  finance: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.4" /><path d="M6 9v6M18 9v6" /></svg>,
  audit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h9l3 3v15H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>,
};

export default function AdminConsole({ account, overview, boxes, audit }: {
  account: { public_id: string };
  overview: Overview;
  boxes: BoxStat[];
  audit: AuditRow[];
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const nav: Tab[] = ['overview', 'moderation', 'users', 'boxes', 'finance', 'audit'];

  return (
    <div className="adm">
      <style>{admCss}</style>
      <div className="adm-shell">
        <aside className="adm-side">
          <div className="adm-brand"><div className="m">◈</div><div className="t">Content Box<small>Admin Console</small></div></div>
          <nav className="adm-nav">
            {nav.map((t) => (
              <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                {I[t]} {TITLES[t] === 'Content Moderation' ? 'Moderation' : TITLES[t] === 'Platform Overview' ? 'Overview' : TITLES[t]}
                {t === 'overview' && overview.open_reports > 0 && <span className="badge">{overview.open_reports}</span>}
              </button>
            ))}
          </nav>
          <div className="adm-who"><b>Operator</b><span className="mono">{account.public_id} · full access</span></div>
        </aside>

        <div className="adm-main">
          <div className="adm-topbar">
            <h1>{TITLES[tab]}</h1>
            <span className="adm-env">PROD · restricted network</span>
          </div>
          <div className="adm-content">
            {tab === 'overview' && <OverviewTab o={overview} boxes={boxes} />}
            {tab === 'moderation' && <ModerationTab />}
            {tab === 'users' && <UsersTab />}
            {tab === 'boxes' && <div className="adm-panel-wrap"><AdminBoxes boxes={boxes} /></div>}
            {tab === 'finance' && <div className="adm-stack"><AdminPayouts /><AdminEconomics /></div>}
            {tab === 'audit' && <AuditTab rows={audit} />}
          </div>
        </div>
      </div>
      <AdminChat />
    </div>
  );
}

function Kpi({ label, value, accent, alert }: { label: string; value: string; accent?: boolean; alert?: boolean }) {
  return (
    <div className={`adm-kpi ${alert ? 'alert' : ''}`}>
      <div className="l">{label}</div>
      <div className="v" style={accent ? { color: 'var(--gold)' } : undefined}>{value}</div>
    </div>
  );
}

function OverviewTab({ o, boxes }: { o: Overview; boxes: BoxStat[] }) {
  const nf = (n: number) => n.toLocaleString();
  return (
    <>
      <div className="adm-kpis">
        <Kpi label="◆ Accounts" value={nf(o.accounts)} />
        <Kpi label="◫ Boxes" value={nf(o.boxes)} />
        <Kpi label="▦ Content" value={nf(o.content)} />
        <Kpi label="◷ Active rentals" value={nf(o.active_rentals)} />
        <Kpi label="⚑ Open reports" value={nf(o.open_reports)} alert={o.open_reports > 0} />
      </div>
      <div className="adm-section-t">Tokens <span className="n">platform economy</span></div>
      <div className="adm-kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <Kpi label="◈ In circulation" value={nf(o.tokens_in_circulation)} accent />
        <Kpi label="→ Creator earnings" value={nf(o.creator_tokens)} accent />
        <Kpi label="→ Platform earnings" value={nf(o.platform_tokens)} accent />
      </div>
      <div className="adm-section-t">Boxes at a glance <span className="n">{boxes.length}</span></div>
      <div className="adm-panel adm-wrap-x">
        <table className="adm-tbl">
          <thead><tr><th>Box</th><th>Users</th><th>Content</th><th>Rentals</th><th>Platform tokens</th></tr></thead>
          <tbody>
            {boxes.length === 0
              ? <tr><td colSpan={5}><div className="adm-empty">No boxes yet.</div></td></tr>
              : boxes.map((b) => (
                <tr key={b.box_id}>
                  <td><span className="adm-idlink">{b.public_id}</span><div className="adm-sub">{b.name}</div></td>
                  <td>{nf(b.users)}</td><td>{nf(b.drops)}</td>
                  <td>{nf(b.rentals)}</td><td className="mono">{nf(b.platform_tokens)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ModerationTab() {
  return (
    <div className="adm-stack">
      <div className="adm-panel" style={{ padding: 18 }}>
        <div className="adm-section-t" style={{ margin: '0 0 8px' }}>Content moderation</div>
        <p className="adm-sub" style={{ margin: '0 0 14px' }}>Review pending drops, reveal originals (audit-logged), approve / reject / escalate.</p>
        <a href="/moderation"><button className="adm-btn p">Open moderation console ↗</button></a>
      </div>
      <div id="verifications"><AdminVerifications /></div>
    </div>
  );
}

function UsersTab() {
  return (
    <div className="adm-stack">
      <div className="adm-panel" style={{ padding: 16 }}>
        <div className="adm-section-t" style={{ margin: '0 0 10px' }}>Lookup <span className="n">USR- / CRT- / CNT- / BOX-</span></div>
        <AdminSearch />
      </div>
      <div id="operators"><AdminTools /></div>
    </div>
  );
}

function AuditTab({ rows }: { rows: AuditRow[] }) {
  return (
    <>
      <div className="adm-section-t">Immutable event trail <span className="n">append-only</span></div>
      <div className="adm-panel adm-audit">
        {rows.length === 0
          ? <div className="adm-empty">No audit entries yet.</div>
          : rows.map((e, i) => (
            <div className="r" key={i}>
              <div className="ts">{e.ts}</div>
              <div className="ev"><b>{e.actor}</b> <span className="act-txt">{e.action}</span> {e.target && <b>{e.target}</b>}<div className="meta">{e.meta}</div></div>
            </div>
          ))}
      </div>
      <div className="adm-hintbar">ⓘ Entries are never edited or deleted. Every sensitive action — viewing an original, revealing a phone, approving a payout, moderating content — lands here automatically.</div>
    </>
  );
}

const admCss = `
.adm{--hi:var(--bad);--md:var(--warn);--lo:var(--ok)}
.adm-shell{display:grid;grid-template-columns:224px 1fr;min-height:100vh;margin:-40px -20px -96px;background:var(--bg)}
.adm-side{background:var(--surface);border-right:1px solid var(--line);display:flex;flex-direction:column;padding:16px 12px;gap:2px;position:sticky;top:0;height:100vh}
.adm-brand{display:flex;align-items:center;gap:10px;padding:6px 8px 16px;margin-bottom:6px;border-bottom:1px solid var(--line)}
.adm-brand .m{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--ember),#8f2f1c);display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;flex:none}
.adm-brand .t{font-family:var(--serif);font-weight:600;font-size:16px;line-height:1.05}
.adm-brand .t small{display:block;font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;color:var(--ink-3);text-transform:uppercase;font-weight:400}
.adm-nav{display:flex;flex-direction:column;gap:2px;margin-top:6px}
.adm-nav button{display:flex;align-items:center;gap:10px;background:none;border:none;cursor:pointer;text-align:left;padding:9px 10px;border-radius:9px;color:var(--ink-2);font:500 13.5px var(--sans);width:100%}
.adm-nav button:hover{background:var(--surface-2);color:var(--ink)}
.adm-nav button.on{background:var(--ember-soft);color:var(--ember)}
.adm-nav svg{width:18px;height:18px;flex:none}
.adm-nav .badge{margin-left:auto;font-family:var(--mono);font-size:10.5px;background:var(--bad);color:#fff;border-radius:9px;padding:1px 6px;min-width:18px;text-align:center}
.adm-who{margin-top:auto;padding:10px 8px 4px;border-top:1px solid var(--line);font-size:11.5px;color:var(--ink-3)}
.adm-who b{color:var(--ink-2);font-weight:600;display:block;font-size:12.5px}
.adm-who .mono{font-size:10.5px}
.adm-main{min-width:0;display:flex;flex-direction:column}
.adm-topbar{height:58px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:14px;padding:0 26px;background:var(--surface);position:sticky;top:0;z-index:5}
.adm-topbar h1{font-family:var(--serif);font-weight:600;font-size:19px;margin:0}
.adm-env{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;color:var(--warn);background:rgba(184,129,28,.14);padding:3px 8px;border-radius:6px;margin-left:auto}
.adm-content{padding:22px 26px 60px;max-width:1220px;width:100%}
.adm-stack{display:flex;flex-direction:column;gap:16px}
.adm-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:6px}
.adm-kpi{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:14px 15px;box-shadow:var(--shadow)}
.adm-kpi .l{font-size:11px;color:var(--ink-3);letter-spacing:.02em;margin-bottom:8px}
.adm-kpi .v{font-family:var(--serif);font-weight:600;font-size:27px;line-height:1}
.adm-kpi.alert{border-color:var(--bad);background:rgba(194,58,43,.10)}
.adm-kpi.alert .v{color:var(--bad)}
.adm-section-t{font-family:var(--serif);font-weight:600;font-size:16px;margin:22px 2px 12px;display:flex;align-items:center;gap:9px}
.adm-section-t .n{font-family:var(--mono);font-size:11px;color:var(--ink-3);background:var(--surface-2);padding:2px 7px;border-radius:6px;font-weight:400}
.adm-panel{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);overflow:hidden}
.adm-panel-wrap>*{margin-top:0}
.adm-wrap-x{overflow-x:auto}
.adm-tbl{width:100%;border-collapse:collapse;font-size:13px}
.adm-tbl th{text-align:left;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);font-weight:600;padding:11px 15px;background:var(--surface-2);border-bottom:1px solid var(--line)}
.adm-tbl td{padding:12px 15px;border-bottom:1px solid var(--line);vertical-align:middle}
.adm-tbl tr:last-child td{border-bottom:none}
.adm-idlink{font-family:var(--mono);font-size:12px;color:var(--ember)}
.adm-sub{font-size:11px;color:var(--ink-3)}
.adm-empty{padding:40px;text-align:center;color:var(--ink-3);font-size:13px}
.adm-btn{font:600 13px var(--sans);border:1px solid var(--line-2);background:var(--surface-2);color:var(--ink);border-radius:9px;padding:9px 15px;cursor:pointer}
.adm-btn.p{background:var(--ember);border-color:transparent;color:#fff}
.adm-audit .r{display:grid;grid-template-columns:150px 1fr;gap:16px;padding:12px 16px;border-bottom:1px solid var(--line);font-size:12.5px}
.adm-audit .r:last-child{border-bottom:none}
.adm-audit .ts{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.adm-audit .ev b{font-family:var(--mono);font-weight:500;color:var(--ember);font-size:12px}
.adm-audit .ev .act-txt{color:var(--ink)}
.adm-audit .meta{color:var(--ink-3);font-size:11px;margin-top:2px}
.adm-hintbar{font-size:11px;color:var(--ink-3);margin-top:12px;line-height:1.45}
@media(max-width:900px){.adm-shell{grid-template-columns:1fr;margin:-40px -20px -96px}.adm-side{position:static;height:auto}.adm-kpis{grid-template-columns:repeat(2,1fr)!important}}
@media(prefers-reduced-motion:reduce){.adm *{transition:none!important}}
`;
