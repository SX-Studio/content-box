import { NextRequest, NextResponse } from 'next/server';
import { currentAccount } from '@/lib/authz';
import { setDisplayName } from '@/lib/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Set or clear this account's nickname.
//
// Deliberately open to ANY authenticated account, with no role check: a nickname is
// how somebody is recognised in a box, and a user invited by link needs one just as
// much as a creator does. The session is the only gate.
export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { displayName } = (await req.json().catch(() => ({}))) as { displayName?: unknown };
  try {
    const saved = await setDisplayName(account.id, displayName);
    return NextResponse.json({ ok: true, displayName: saved });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
