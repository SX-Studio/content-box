import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { decidePayout } from '@/lib/payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator decides a payout request: paid (money sent off-platform) or rejected.
export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!(await hasRole(account.id, 'platform_operator'))) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  const { payoutId, paid, note } = (await req.json().catch(() => ({}))) as { payoutId?: string; paid?: boolean; note?: string };
  if (!payoutId || typeof paid !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'payoutId and paid are required' }, { status: 400 });
  }
  try {
    const payout = await decidePayout(payoutId, account.id, paid, note?.trim() || null);
    return NextResponse.json({ ok: true, payout });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
