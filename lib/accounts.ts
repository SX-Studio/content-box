import 'server-only';
import { admin } from '@/lib/supabase/admin';
import { encryptPhone, phoneHash } from '@/lib/crypto';
import { publicId } from '@/lib/ids';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';

export type Account = {
  id: string;
  public_id: string;
  status: string;
  phone_verified_at: string | null;
  email: string | null;
};

const SELECT = 'id, public_id, status, phone_verified_at, email';

// bytea columns take a Postgres hex literal (\x…) over PostgREST, not a raw Buffer.
function toBytea(buf: Buffer): string {
  return `\\x${buf.toString('hex')}`;
}

// Normalise an optional contact email. Empty → null (clears it); throws on invalid.
export function normalizeEmail(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error('Enter a valid email address');
  return s;
}

// Set (or clear, with null) an account's contact email.
export async function setAccountEmail(accountId: string, email: string | null): Promise<void> {
  await admin().from('account').update({ email }).eq('id', accountId);
}

export async function findAccountByPhoneHash(hash: string): Promise<Account | null> {
  const { data } = await admin().from('account').select(SELECT).eq('phone_hash', hash).maybeSingle();
  return (data as Account) ?? null;
}

// Find the account for a verified phone, or create it. The very first account in the
// system is bootstrapped as platform_operator so there's someone who can create boxes.
// Grant platform_operator to an account whose phone is on the admin allowlist.
// Idempotent — safe to call on every login. Matched by keyed HMAC (no plaintext).
export async function ensureOperatorIfAllowlisted(accountId: string, hash: string): Promise<void> {
  const { data: allow } = await admin()
    .from('admin_phone_allowlist')
    .select('phone_hash')
    .eq('phone_hash', hash)
    .maybeSingle();
  if (!allow) return;
  const { data: role } = await admin()
    .from('account_role')
    .select('id')
    .eq('account_id', accountId)
    .eq('role', 'platform_operator')
    .is('box_id', null)
    .maybeSingle();
  if (role) return;
  await admin().from('account_role').insert({ account_id: accountId, role: 'platform_operator', box_id: null });
  await writeAudit({ actorId: accountId, action: 'account.operator_from_allowlist', targetType: 'account', targetId: accountId });
}

export async function findOrCreateAccount(e164: string): Promise<{ account: Account; isNew: boolean }> {
  const hash = phoneHash(e164);
  const existing = await findAccountByPhoneHash(hash);
  if (existing) {
    if (!existing.phone_verified_at) {
      await admin().from('account').update({ phone_verified_at: new Date().toISOString() }).eq('id', existing.id);
    }
    await ensureOperatorIfAllowlisted(existing.id, hash);
    return { account: existing, isNew: false };
  }

  const { data, error } = await admin()
    .from('account')
    .insert({
      public_id: publicId('USR'),
      phone_enc: toBytea(encryptPhone(e164)),
      phone_hash: hash,
      phone_verified_at: new Date().toISOString(),
    })
    .select(SELECT)
    .single();
  if (error || !data) throw new Error(error?.message ?? 'account create failed');
  const account = data as Account;

  const { count } = await admin().from('account').select('id', { count: 'exact', head: true });
  if ((count ?? 0) === 1) {
    await admin().from('account_role').insert({ account_id: account.id, role: 'platform_operator', box_id: null });
    await writeAudit({ actorId: account.id, action: 'account.bootstrap_operator', targetType: 'account', targetId: account.public_id });
  }
  await writeAudit({ actorId: account.id, action: 'account.created', targetType: 'account', targetId: account.public_id });
  await emit('ACCOUNT_CREATED', { account_id: account.id, public_id: account.public_id });
  await ensureOperatorIfAllowlisted(account.id, hash);
  return { account, isNew: true };
}
