import { NextResponse } from 'next/server';
import { currentAccount, accountRoles } from '@/lib/authz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Whoami — the authenticated account and its roles, or 401. Useful for the client and
// for smoke-testing the session.
export async function GET() {
  const account = await currentAccount();
  if (!account) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const roles = await accountRoles(account.id);
  return NextResponse.json({
    ok: true,
    account: { public_id: account.public_id, status: account.status, email: account.email ?? null },
    roles,
  });
}
