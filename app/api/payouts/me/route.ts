import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/authz';
import { getCreatorEarnings } from '@/lib/payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A creator's own earnings snapshot + payout history.
export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const earnings = await getCreatorEarnings(account.id);
  return NextResponse.json({ ok: true, ...earnings });
}
