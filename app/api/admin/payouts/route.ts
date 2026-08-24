import { NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { listRequestedPayouts } from '@/lib/payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator: list pending payout requests to triage.
export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!(await hasRole(account.id, 'platform_operator'))) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }
  const payouts = await listRequestedPayouts();
  return NextResponse.json({ ok: true, payouts });
}
