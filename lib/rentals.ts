import 'server-only';
import { admin } from '@/lib/supabase/admin';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';

export type MyRental = {
  public_id: string;
  content_public_id: string;
  title: string;
  creator: string | null;
  creator_name: string | null;
  expires_at: string;
  preview_url: string | null;
};

// Rent by content public id. Atomic via rent_content(); friendly errors on the way out.
export async function rentContent(userId: string, contentPublicId: string, idempotencyKey: string): Promise<{ rentalPublicId: string; expiresAt: string; price: number }> {
  const { data: content } = await admin()
    .from('content')
    .select('id, public_id, box:box_id ( status )')
    .eq('public_id', contentPublicId)
    .maybeSingle();
  if (!content) throw new Error('Content not found');
  // rent_content() takes a content id and knows nothing about boxes, so without this an
  // archived box's items stay rentable to anyone holding a direct link — money changes
  // hands for a box the operator believes is gone.
  const box = (content as unknown as { box?: { status?: string } | null }).box;
  if (box?.status === 'archived') throw new Error('This content is no longer available');

  const { data, error } = await admin().rpc('rent_content', {
    p_user: userId,
    p_content: (content as { id: string }).id,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    const m = error.message;
    if (m.includes('INSUFFICIENT_FUNDS')) throw new Error('Not enough tokens — top up your wallet');
    if (m.includes('CANNOT_RENT_OWN')) throw new Error('You cannot rent your own content');
    if (m.includes('CONTENT_UNAVAILABLE')) throw new Error('This content is not available');
    throw new Error(m);
  }
  const row = (data as { rental_public_id: string; expires_at: string; price: number }[])[0];
  await writeAudit({ actorId: userId, action: 'rental.created', targetType: 'content', targetId: contentPublicId, metadata: { rental: row.rental_public_id } });
  await emit('RENTAL_CREATED', { user_id: userId, content_public_id: contentPublicId, rental: row.rental_public_id });
  return { rentalPublicId: row.rental_public_id, expiresAt: row.expires_at, price: row.price };
}

// Authoritative access check → short-lived signed URL for the master. No active,
// unexpired rental means no URL.
export async function viewContent(userId: string, contentPublicId: string): Promise<string[] | null> {
  const { data: content } = await admin().from('content').select('id, status, creator_id').eq('public_id', contentPublicId).maybeSingle();
  if (!content) return null;
  const c = content as { id: string; status: string; creator_id: string };
  const contentId = c.id;
  const isOwner = c.creator_id === userId;

  // Creators can always view their own master (no rental needed). Everyone else needs
  // an active rental AND the content must still be approved (moderation tie-in).
  if (!isOwner) {
    if (c.status !== 'approved') return null;
    const { data: rental } = await admin()
      .from('rental')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!rental) return null;
  }

  // Every asset, in order — a content item can carry several photos, and a renter who
  // paid for the item is entitled to all of them, not just the cover.
  const { data: assets } = await admin()
    .from('content_asset')
    .select('storage_path, kind, position')
    .eq('content_id', contentId)
    .order('position', { ascending: true });
  const rows = (assets as { storage_path: string; kind: string; position: number }[] | null) ?? [];
  if (rows.length === 0) return null;

  const urls: string[] = [];
  for (const a of rows) {
    const { data: signed } = await admin().storage.from('master').createSignedUrl(a.storage_path, 120);
    if (signed?.signedUrl) urls.push(signed.signedUrl);
  }
  return urls.length > 0 ? urls : null;
}

export async function listMyRentals(userId: string): Promise<MyRental[]> {
  const { data } = await admin()
    .from('rental')
    .select('public_id, expires_at, content:content_id ( public_id, title, creator:creator_id ( public_id, display_name ), assets:content_asset ( preview_path, position ) )')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });

  return ((data ?? []) as unknown as {
    public_id: string;
    expires_at: string;
    content: {
      public_id: string;
      title: string;
      creator: { public_id: string; display_name: string | null } | null;
      assets: { preview_path: string | null; position: number }[];
    } | null;
  }[]).map((r) => {
    const asset = [...(r.content?.assets ?? [])].sort((a, b) => a.position - b.position)[0];
    return {
      public_id: r.public_id,
      content_public_id: r.content?.public_id ?? '',
      title: r.content?.title ?? '',
      creator: r.content?.creator?.public_id ?? null,
      creator_name: r.content?.creator?.display_name ?? null,
      expires_at: r.expires_at,
      preview_url: asset?.preview_path
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/preview/${asset.preview_path}`
        : null,
    };
  });
}

// Scheduled expiry sweep — flips active rentals whose timer has passed. Access
// checks (viewContent) already enforce expiry lazily; this keeps listings honest.
export async function expireRentals(): Promise<number> {
  const { data, error } = await admin().rpc('expire_rentals');
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}
