import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { restoreBox } from '@/lib/boxes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Bring an archived box back. Archiving is reversible on purpose — without this an
// operator who archived the wrong box would have destroyed it, which is the outcome
// archiving exists to avoid.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!(await hasRole(account.id, 'platform_operator'))) {
    return NextResponse.json({ ok: false, error: 'Platform operators only' }, { status: 403 });
  }
  try {
    const box = await restoreBox({ boxPublicId: params.id, actorId: account.id });
    return NextResponse.json({ ok: true, box });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
