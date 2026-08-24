import { NextRequest, NextResponse } from 'next/server';
import { currentAccount } from '@/lib/authz';
import { normalizeEmail, setAccountEmail } from '@/lib/accounts';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Set or clear the account's optional contact email (used for notifications).
export async function POST(req: NextRequest) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { email } = (await req.json().catch(() => ({}))) as { email?: unknown };
  let normalized: string | null;
  try {
    normalized = normalizeEmail(email);
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }

  await setAccountEmail(account.id, normalized);
  await writeAudit({ actorId: account.id, action: normalized ? 'account.email_set' : 'account.email_cleared', targetType: 'account', targetId: account.public_id });
  return NextResponse.json({ ok: true, email: normalized });
}
