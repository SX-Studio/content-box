import 'server-only';
import { admin } from '@/lib/supabase/admin';
import { publicId } from '@/lib/ids';
import { getConfig } from '@/lib/config';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';

export type PayoutRow = {
  public_id: string;
  amount_tokens: number;
  eur_cents: number;
  status: 'requested' | 'paid' | 'rejected';
  note: string | null;
  requested_at: string;
  decided_at: string | null;
};

export type CreatorEarnings = {
  available_tokens: number; // countable now (available + not reserved)
  reserved_tokens: number; // in an open payout request
  withdrawn_tokens: number; // already paid out
  threshold_tokens: number;
  payouts: PayoutRow[];
};

const PAYOUT_SELECT = 'public_id, amount_tokens, eur_cents, status, note, requested_at, decided_at';

// Creator's earnings snapshot + payout history. Earnings live in public.earning;
// a payout reserves available rows via earning.payout_id.
export async function getCreatorEarnings(accountId: string): Promise<CreatorEarnings> {
  const [earnRes, payoutsRes, tpe, thrEur] = await Promise.all([
    admin().from('earning').select('creator_tokens, state, payout_id').eq('creator_id', accountId),
    admin().from('payout').select(PAYOUT_SELECT).eq('creator_id', accountId).order('requested_at', { ascending: false }).limit(20),
    getConfig<number>('tokens_per_euro'),
    getConfig<number>('payout_threshold_eur'),
  ]);

  const rows = (earnRes.data ?? []) as { creator_tokens: number; state: string; payout_id: string | null }[];
  let available = 0, reserved = 0, withdrawn = 0;
  for (const e of rows) {
    if (e.state === 'withdrawn') withdrawn += e.creator_tokens;
    else if (e.payout_id) reserved += e.creator_tokens;
    else if (e.state === 'available') available += e.creator_tokens;
  }

  return {
    available_tokens: available,
    reserved_tokens: reserved,
    withdrawn_tokens: withdrawn,
    threshold_tokens: Math.ceil(Number(thrEur) * Number(tpe)),
    payouts: (payoutsRes.data ?? []) as PayoutRow[],
  };
}

// Reserve all available earnings into one payout request. Atomic via request_payout().
export async function requestPayout(accountId: string, accountPublicId: string): Promise<PayoutRow> {
  const { data, error } = await admin().rpc('request_payout', { p_creator: accountId, p_public_id: publicId('PAY') });
  if (error) {
    if (error.message.includes('BELOW_THRESHOLD')) throw new Error('You have not reached the payout threshold yet');
    throw new Error(error.message);
  }
  const row = data as PayoutRow;
  await writeAudit({ actorId: accountId, action: 'payout.requested', targetType: 'payout', targetId: row.public_id, metadata: { amount_tokens: row.amount_tokens } });
  await emit('PAYOUT_REQUESTED', { creator_id: accountId, payout: row.public_id, amount_tokens: row.amount_tokens });
  return row;
}

// Operator view: all pending payout requests with the creator's public id.
export async function listRequestedPayouts(): Promise<(PayoutRow & { creator: string })[]> {
  const { data } = await admin()
    .from('payout')
    .select(`${PAYOUT_SELECT}, account:creator_id ( public_id )`)
    .eq('status', 'requested')
    .order('requested_at', { ascending: true });

  return ((data ?? []) as unknown as (PayoutRow & { account: { public_id: string } | null })[]).map((p) => ({
    ...p,
    creator: p.account?.public_id ?? '',
  }));
}

// Operator decision. paid=true → earnings become withdrawn; false → released.
export async function decidePayout(payoutPublicId: string, deciderId: string, paid: boolean, note: string | null): Promise<PayoutRow> {
  const { data: found } = await admin().from('payout').select('id').eq('public_id', payoutPublicId).maybeSingle();
  if (!found) throw new Error('Payout not found');

  const { data, error } = await admin().rpc('decide_payout', {
    p_payout: (found as { id: string }).id,
    p_decider: deciderId,
    p_paid: paid,
    p_note: note,
  });
  if (error) {
    if (error.message.includes('ALREADY_DECIDED')) throw new Error('This payout has already been decided');
    throw new Error(error.message);
  }
  const row = data as PayoutRow;
  await writeAudit({ actorId: deciderId, action: paid ? 'payout.paid' : 'payout.rejected', targetType: 'payout', targetId: row.public_id });
  await emit(paid ? 'PAYOUT_PAID' : 'PAYOUT_REJECTED', { payout: row.public_id });
  return row;
}
