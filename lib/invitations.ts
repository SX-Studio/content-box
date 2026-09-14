import 'server-only';
import { randomBytes, createHmac } from 'crypto';
import { admin } from '@/lib/supabase/admin';
import { encryptPhone, phoneHash, toE164 } from '@/lib/crypto';
import { publicId } from '@/lib/ids';
import { env } from '@/lib/env';
import { getConfig } from '@/lib/config';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';

// The raw token lives ONLY in the SMS link; the DB stores its keyed hash.
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}
export function hashInviteToken(token: string): string {
  return createHmac('sha256', env.sessionSecret()).update(`invite:${token}`).digest('hex');
}
function toBytea(buf: Buffer): string {
  return `\\x${buf.toString('hex')}`;
}

export type NewInvitation = { id: string; public_id: string; target_role: string; expires_at: string };

// Create a single-use, expiring, phone-bound invitation. Returns the raw token so the
// caller can build the SMS link (the token is never persisted in the clear).
export async function createInvitation(opts: {
  boxId: string;
  targetPhone: string;
  targetRole: 'box_admin' | 'creator' | 'user';
  invitedBy: string;
}): Promise<{ invitation: NewInvitation; token: string }> {
  if (!['box_admin', 'creator', 'user'].includes(opts.targetRole)) {
    throw new Error('Role must be box_admin, creator or user');
  }
  const e164 = toE164(opts.targetPhone);
  const ttlHours = Number(await getConfig<number>('invitation_ttl_hours')) || 72;
  const token = generateInviteToken();

  const { data, error } = await admin()
    .from('invitation')
    .insert({
      public_id: publicId('INV'),
      box_id: opts.boxId,
      target_role: opts.targetRole,
      target_phone_enc: toBytea(encryptPhone(e164)),
      target_phone_hash: phoneHash(e164),
      token_hash: hashInviteToken(token),
      invited_by: opts.invitedBy,
      expires_at: new Date(Date.now() + ttlHours * 3600 * 1000).toISOString(),
    })
    .select('id, public_id, target_role, expires_at')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'invitation create failed');

  await writeAudit({ actorId: opts.invitedBy, action: 'invitation.sent', targetType: 'invitation', targetId: data.public_id, metadata: { role: opts.targetRole, box_id: opts.boxId } });
  await emit('INVITATION_SENT', { invitation_id: data.id, box_id: opts.boxId, target_role: opts.targetRole });
  return { invitation: data as NewInvitation, token };
}

// Accept an invitation. The caller must already be OTP-verified (has a session) AND
// their verified phone must match the invitation's target. Idempotent and race-safe.
export async function acceptInvitation(opts: { token: string; accountId: string }): Promise<{ boxPublicId: string; role: string }> {
  const tokenHash = hashInviteToken(opts.token);
  const { data: inv } = await admin()
    .from('invitation')
    .select('id, public_id, box_id, target_role, target_phone_hash, invited_by, expires_at, used_at, revoked_at, box:box_id ( public_id )')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (!inv) throw new Error('Invitation not found');
  if (inv.used_at) throw new Error('This invitation has already been used');
  if (inv.revoked_at) throw new Error('This invitation was revoked');
  if (new Date(inv.expires_at as string).getTime() < Date.now()) throw new Error('This invitation has expired');

  const { data: acc } = await admin().from('account').select('id, phone_hash').eq('id', opts.accountId).maybeSingle();
  if (!acc) throw new Error('Account not found');
  if ((acc as { phone_hash: string }).phone_hash !== inv.target_phone_hash) {
    throw new Error('This invitation was issued to a different phone number');
  }

  await admin()
    .from('box_membership')
    .upsert(
      { box_id: inv.box_id, account_id: acc.id, role: inv.target_role, invited_by: inv.invited_by },
      { onConflict: 'box_id,account_id', ignoreDuplicates: true }
    );
  await admin()
    .from('account_role')
    .upsert(
      { account_id: acc.id, role: inv.target_role, box_id: inv.box_id },
      { onConflict: 'account_id,role,box_id', ignoreDuplicates: true }
    );
  await admin().from('invitation').update({ used_at: new Date().toISOString() }).eq('id', inv.id).is('used_at', null);

  await writeAudit({ actorId: acc.id, action: 'invitation.accepted', targetType: 'invitation', targetId: inv.public_id, metadata: { role: inv.target_role, box_id: inv.box_id } });
  await emit('MEMBERSHIP_CREATED', { box_id: inv.box_id, account_id: acc.id, role: inv.target_role });

  const boxPublicId = (inv.box as unknown as { public_id: string } | null)?.public_id ?? '';
  return { boxPublicId, role: inv.target_role as string };
}
