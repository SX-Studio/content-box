import { NextRequest, NextResponse } from 'next/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Revoke an unused invitation. With link delivery the token can be pasted anywhere, so
// a kill switch is the counterpart to handing the link out: acceptInvitation already
// refuses a revoked row, but until now nothing could ever set revoked_at.
export async function POST(_req: NextRequest, { params }: { params: { id: string; inviteId: string } }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { data: box } = await admin().from('box').select('id').eq('public_id', params.id).maybeSingle();
  if (!box) return NextResponse.json({ ok: false, error: 'Box not found' }, { status: 404 });

  const isOperator = await hasRole(account.id, 'platform_operator');
  const allowed = isOperator || (await hasRole(account.id, 'box_admin', (box as { id: string }).id));
  if (!allowed) return NextResponse.json({ ok: false, error: 'Only box admins can revoke invitations' }, { status: 403 });

  const { data: inv } = await admin()
    .from('invitation')
    .select('id, public_id, target_role, used_at, revoked_at')
    .eq('public_id', params.inviteId)
    .eq('box_id', (box as { id: string }).id)
    .maybeSingle();
  if (!inv) return NextResponse.json({ ok: false, error: 'Invitation not found' }, { status: 404 });

  const row = inv as { id: string; public_id: string; target_role: string; used_at: string | null; revoked_at: string | null };

  // Mirrors who may CREATE one: a box admin cannot appoint another admin, so it must
  // not be able to undo an operator's appointment either.
  if (row.target_role === 'box_admin' && !isOperator) {
    return NextResponse.json({ ok: false, error: 'Only platform operators can revoke a box admin invitation' }, { status: 403 });
  }
  if (row.used_at) return NextResponse.json({ ok: false, error: 'This invitation has already been accepted' }, { status: 409 });
  if (row.revoked_at) return NextResponse.json({ ok: true, alreadyRevoked: true });

  const revokedAt = new Date().toISOString();
  const { data: updated } = await admin()
    .from('invitation')
    .update({ revoked_at: revokedAt })
    .eq('id', row.id)
    .is('used_at', null)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  // Lost the race against an accept: the guards above are advisory, this is the real one.
  if (!updated) return NextResponse.json({ ok: false, error: 'Invitation was accepted before it could be revoked' }, { status: 409 });

  await writeAudit({
    actorId: account.id,
    action: 'invitation.revoked',
    targetType: 'invitation',
    targetId: row.public_id,
    metadata: { role: row.target_role, box_id: (box as { id: string }).id },
  });
  await emit('invitation.revoked', { invitation: row.public_id, role: row.target_role });

  return NextResponse.json({ ok: true, revoked_at: revokedAt });
}
