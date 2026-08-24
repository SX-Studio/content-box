import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/authz';
import { requestPayout } from '@/lib/payouts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A creator requests a payout of all their available earnings.
export async function POST() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  try {
    const payout = await requestPayout(account.id, account.public_id);
    return NextResponse.json({ ok: true, payout });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
