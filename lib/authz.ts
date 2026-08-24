import 'server-only';
import { admin } from '@/lib/supabase/admin';
import { getSessionSub } from '@/lib/session-cookie';
import type { Account } from '@/lib/accounts';

export type Role = 'platform_operator' | 'moderator' | 'box_admin' | 'creator' | 'user';
export type RoleRow = { role: Role; box_id: string | null };

// The authenticated account for this request, or null. Suspended accounts are treated
// as unauthenticated.
export async function currentAccount(): Promise<Account | null> {
  const sub = await getSessionSub();
  if (!sub) return null;
  const { data } = await admin()
    .from('account')
    .select('id, public_id, status, phone_verified_at, email')
    .eq('id', sub)
    .maybeSingle();
  const acc = data as Account | null;
  if (!acc || acc.status !== 'active') return null;
  return acc;
}

export async function accountRoles(accountId: string): Promise<RoleRow[]> {
  const { data } = await admin().from('account_role').select('role, box_id').eq('account_id', accountId);
  return (data as RoleRow[]) ?? [];
}

// Role check. Pass boxId to require the role within a specific box; omit to match the
// role in any scope (platform_operator, being box_id null, always matches box checks too).
export async function hasRole(accountId: string, role: Role, boxId?: string | null): Promise<boolean> {
  const roles = await accountRoles(accountId);
  if (roles.some((r) => r.role === 'platform_operator')) return true;
  return roles.some((r) => r.role === role && (boxId === undefined || r.box_id === boxId));
}
