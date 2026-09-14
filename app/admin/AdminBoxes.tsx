'use client';
import { useState } from 'react';

export type BoxStat = {
  box_id: string;
  public_id: string;
  name: string;
  status: string;
  users: number;
  drops: number;
  rentals: number;
  tokens_in: number;
  creator_tokens: number;
  platform_tokens: number;
};

const eur = (tokens: number) => `€${(tokens / 100).toFixed(2)}`; // 100 tokens = €1

// "Various groups / Box Page": box-group cards, each showing a € earnings chip on
// the face; tap to expand per-box performance (in / out / total / earning / users).
export default function AdminBoxes({ boxes }: { boxes: BoxStat[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      <strong>Box groups</strong>
      {boxes.length === 0 ? (
        <div className="card" style={{ marginTop: 8 }}><p className="dim" style={{ margin: 0 }}>No boxes.</p></div>
      ) : (
        <div className="row" style={{ flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
          {boxes.map((b) => {
            const isOpen = open === b.box_id;
            return (
              <div className="card" key={b.box_id} style={{ flex: '1 1 220px', minWidth: 220, cursor: 'pointer' }}
                   onClick={() => setOpen(isOpen ? null : b.box_id)}>
                <div className="between">
                  <strong>{b.name}</strong>
                  <span className="pill">{b.status}</span>
                </div>
                <div className="between" style={{ marginTop: 4 }}>
                  <span className="dim mono" style={{ fontSize: 11 }}>{b.public_id}</span>
                  <span className="pill mono" style={{ background: 'var(--gold,var(--gold))', color: '#fff' }}>{eur(b.tokens_in)}</span>
                </div>
                <div className="row" style={{ gap: 12, marginTop: 8, fontSize: 13 }}>
                  <span>👤 {b.users}</span>
                  <span>🖼 {b.drops}</span>
                  <span>⏱ {b.rentals}</span>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--line,var(--surface-3))', paddingTop: 8, fontSize: 13 }}>
                    <Row label="In (tokens)" value={String(b.tokens_in)} />
                    <Row label="Out — platform" value={String(b.platform_tokens)} />
                    <Row label="Earning — creator" value={String(b.creator_tokens)} />
                    <Row label="Total drops" value={String(b.drops)} />
                    <Row label="Users" value={String(b.users)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="between" style={{ padding: '2px 0' }}>
      <span className="dim">{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}
