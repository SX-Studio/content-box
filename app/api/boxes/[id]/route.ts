import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { getBoxForAccount, renameBox } from '@/lib/boxes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Box detail by public id (BOX-…). Gated to members, or any platform operator.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const isOperator = await hasRole(account.id, 'platform_operator');
  const box = await getBoxForAccount(params.id, account.id, isOperator);
  if (!box) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, box });
}

// Rename a box — App Admin (platform operator) or a box admin of this box.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const isOperator = await hasRole(account.id, 'platform_operator');
  const box = await getBoxForAccount(params.id, account.id, isOperator);
  if (!box) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (!isOperator && box.role !== 'box_admin') {
    return NextResponse.json({ ok: false, error: 'Only box admins or platform operators can rename a box' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }
  const name = String((body as { name?: unknown })?.name ?? '');

  try {
    const updated = await renameBox({ boxPublicId: params.id, name, actorId: account.id });
    return NextResponse.json({ ok: true, box: updated });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
