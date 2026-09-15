import 'server-only';
import { admin } from '@/lib/supabase/admin';
import { publicId } from '@/lib/ids';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';

export type Box = {
  id: string;
  public_id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};
export type BoxWithRole = Box & { role?: string; adminCount?: number };

const SELECT = 'id, public_id, name, description, status, created_at';

// Pure, testable name check.
export function validateBoxName(raw: string): string {
  const name = (raw ?? '').trim();
  if (name.length < 1 || name.length > 120) {
    throw new Error('Box name must be 1–120 characters');
  }
  return name;
}

// Create a box. Whoever creates it — operator or creator — becomes its first box_admin,
// so the box always has someone who can invite into it and run it.
export async function createBox(opts: { name: string; description?: string | null; createdBy: string }): Promise<Box> {
  const name = validateBoxName(opts.name);
  const { data, error } = await admin()
    .from('box')
    .insert({
      public_id: publicId('BOX'),
      name,
      description: opts.description?.trim() || null,
      created_by: opts.createdBy,
    })
    .select(SELECT)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'box create failed');
  const box = data as Box;

  await admin().from('box_membership').insert({ box_id: box.id, account_id: opts.createdBy, role: 'box_admin', invited_by: opts.createdBy });
  await admin().from('account_role').insert({ account_id: opts.createdBy, role: 'box_admin', box_id: box.id });
  await writeAudit({ actorId: opts.createdBy, action: 'box.created', targetType: 'box', targetId: box.public_id, metadata: { name } });
  await emit('BOX_CREATED', { box_id: box.id, public_id: box.public_id, created_by: opts.createdBy });
  return box;
}

// Rename a box (App Admin / box admin action). Returns the updated row.
export async function renameBox(opts: { boxPublicId: string; name: string; actorId: string }): Promise<Box> {
  const name = validateBoxName(opts.name);
  const { data, error } = await admin()
    .from('box')
    .update({ name })
    .eq('public_id', opts.boxPublicId)
    .select(SELECT)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'box rename failed');
  const box = data as Box;
  await writeAudit({ actorId: opts.actorId, action: 'box.renamed', targetType: 'box', targetId: box.public_id, metadata: { name } });
  await emit('BOX_RENAMED', { box_id: box.id, public_id: box.public_id, name, by: opts.actorId });
  return box;
}

// Who actually runs a box: active box_admins who are NOT platform operators. An
// operator is box_admin on every box they created, so counting admins naively makes
// every box look staffed and hides the ones still waiting to be handed over.
export function tallyNonOperatorAdmins(
  boxIds: string[],
  admins: { box_id: string; account_id: string }[],
  operatorIds: Set<string>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of boxIds) counts[id] = 0;
  for (const a of admins) {
    if (operatorIds.has(a.account_id)) continue;
    if (!(a.box_id in counts)) continue;
    counts[a.box_id] += 1;
  }
  return counts;
}

// Two queries regardless of how many boxes there are.
async function nonOperatorAdminCounts(boxIds: string[]): Promise<Record<string, number>> {
  if (!boxIds.length) return {};

  const { data: memberships } = await admin()
    .from('box_membership')
    .select('box_id, account_id')
    .in('box_id', boxIds)
    .eq('role', 'box_admin')
    .eq('status', 'active');
  const rows = (memberships ?? []) as { box_id: string; account_id: string }[];
  if (!rows.length) return tallyNonOperatorAdmins(boxIds, [], new Set());

  const { data: operators } = await admin()
    .from('account_role')
    .select('account_id')
    .eq('role', 'platform_operator')
    .in('account_id', [...new Set(rows.map((r) => r.account_id))]);
  const operatorIds = new Set(((operators ?? []) as { account_id: string }[]).map((o) => o.account_id));

  return tallyNonOperatorAdmins(boxIds, rows, operatorIds);
}

// Operators see every box; everyone else sees the boxes they belong to. adminCount is
// attached for operators only — they are the only ones who can appoint a box admin, so
// on anyone else's dashboard it would be noise that costs two extra queries.
export async function listBoxesForAccount(accountId: string, isOperator: boolean): Promise<BoxWithRole[]> {
  if (isOperator) {
    const { data } = await admin().from('box').select(SELECT).order('created_at', { ascending: false });
    const boxes = (data ?? []) as Box[];
    const counts = await nonOperatorAdminCounts(boxes.map((b) => b.id));
    return boxes.map((b) => ({ ...b, adminCount: counts[b.id] ?? 0 }));
  }
  const { data } = await admin()
    .from('box_membership')
    .select(`role, box:box_id ( ${SELECT} )`)
    .eq('account_id', accountId)
    .eq('status', 'active');
  // The .eq above is on the MEMBERSHIP status. The box's own status is a separate
  // field and was never filtered anywhere — which is why archiving used to hide nothing.
  return ((data ?? []) as unknown as { role: string; box: Box }[])
    .filter((r) => r.box && r.box.status !== 'archived')
    .map((r) => ({ ...r.box, role: r.role }));
}

// Deleting a box CASCADES to content, rental, box_membership and invitation. A rental is
// a paid 24h entitlement, so hard-deleting a box that has any history destroys access
// somebody bought and the record of what they bought (the ledger debit survives, its
// counterpart does not). So a hard delete is reserved for a box that has never held
// anything — a typo made two minutes ago. Everything else archives.
export function boxRemovalMode(contentCount: number, rentalCount: number): 'delete' | 'archive' {
  return contentCount === 0 && rentalCount === 0 ? 'delete' : 'archive';
}

export type BoxRemoval = { mode: 'delete' | 'archive'; contentCount: number; rentalCount: number; box: Box };

export async function removeBox(opts: { boxPublicId: string; actorId: string }): Promise<BoxRemoval> {
  const { data: found } = await admin().from('box').select(SELECT).eq('public_id', opts.boxPublicId).maybeSingle();
  if (!found) throw new Error('Box not found');
  const box = found as Box;

  const [{ count: contentCount }, { count: rentalCount }] = await Promise.all([
    admin().from('content').select('id', { count: 'exact', head: true }).eq('box_id', box.id),
    admin().from('rental').select('id', { count: 'exact', head: true }).eq('box_id', box.id),
  ]);
  const content = contentCount ?? 0;
  const rentals = rentalCount ?? 0;
  const mode = boxRemovalMode(content, rentals);

  if (mode === 'delete') {
    const { error } = await admin().from('box').delete().eq('id', box.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin().from('box').update({ status: 'archived' }).eq('id', box.id);
    if (error) throw new Error(error.message);
  }

  await writeAudit({
    actorId: opts.actorId,
    action: mode === 'delete' ? 'box.deleted' : 'box.archived',
    targetType: 'box',
    targetId: box.public_id,
    metadata: { name: box.name, content_count: content, rental_count: rentals },
  });
  await emit(mode === 'delete' ? 'BOX_DELETED' : 'BOX_ARCHIVED', {
    public_id: box.public_id, by: opts.actorId, content_count: content, rental_count: rentals,
  });
  return { mode, contentCount: content, rentalCount: rentals, box };
}

// Archiving is reversible on purpose — an operator who archives the wrong box would
// otherwise have destroyed it, which is exactly what archiving exists to avoid.
export async function restoreBox(opts: { boxPublicId: string; actorId: string }): Promise<Box> {
  const { data, error } = await admin()
    .from('box')
    .update({ status: 'active' })
    .eq('public_id', opts.boxPublicId)
    .select(SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Box not found');
  const box = data as Box;
  await writeAudit({ actorId: opts.actorId, action: 'box.restored', targetType: 'box', targetId: box.public_id });
  await emit('BOX_RESTORED', { public_id: box.public_id, by: opts.actorId });
  return box;
}

// An archived box is invisible and unusable to everyone except operators, who still need
// to see it to restore it. Every other gate (feed, discover, upload, rent) enforces the
// same rule at its own layer — status on the box row alone stops nothing.
export async function isBoxArchived(boxId: string): Promise<boolean> {
  const { data } = await admin().from('box').select('status').eq('id', boxId).maybeSingle();
  return (data as { status?: string } | null)?.status === 'archived';
}

export async function getBoxForAccount(boxPublicId: string, accountId: string, isOperator: boolean): Promise<BoxWithRole | null> {
  const { data: box } = await admin().from('box').select(SELECT).eq('public_id', boxPublicId).maybeSingle();
  if (!box) return null;
  if (isOperator) return box as Box;
  if ((box as Box).status === 'archived') return null;
  const { data: mem } = await admin()
    .from('box_membership')
    .select('role')
    .eq('box_id', (box as Box).id)
    .eq('account_id', accountId)
    .eq('status', 'active')
    .maybeSingle();
  if (!mem) return null;
  return { ...(box as Box), role: (mem as { role: string }).role };
}
