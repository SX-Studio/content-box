import 'server-only';
import { admin } from '@/lib/supabase/admin';
import { uploadObject, signedUrl } from '@/lib/storage';
import { extForMime } from '@/lib/content';
import { writeAudit } from '@/lib/audit';
import { emit } from '@/lib/events';
import { sendSms, smsConfigured } from '@/lib/sms';
import { sendEmail, emailConfigured } from '@/lib/email';
import { decryptPhone, fromBytea } from '@/lib/crypto';

export const DOCUMENT_TYPES = ['passport', 'id_card', 'drivers_license'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const ID_MAX_BYTES = 2 * 1024 * 1024; // 2 MB per file (keeps a 2-file POST under the serverless body limit)

export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type MyVerification = { status: VerificationStatus; rejection_reason: string | null; submitted_at: string } | null;

// Whether a creator has cleared 18+/ID review — the gate for publishing content.
export async function isAgeVerified(accountId: string): Promise<boolean> {
  const { data } = await admin().from('account').select('age_verified_at').eq('id', accountId).maybeSingle();
  return Boolean((data as { age_verified_at: string | null } | null)?.age_verified_at);
}

export async function getMyVerification(accountId: string): Promise<MyVerification> {
  const { data } = await admin()
    .from('identity_verification')
    .select('status, rejection_reason, submitted_at')
    .eq('account_id', accountId)
    .maybeSingle();
  return (data as MyVerification) ?? null;
}

// Compute age in whole years at today's date.
export function ageFromDob(dob: string): number {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date of birth');
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export type SubmitInput = {
  fullName: string;
  dob: string;
  country: string | null;
  documentType: string;
  consent: boolean;
  document: { buffer: Buffer; mime: string };
  selfie?: { buffer: Buffer; mime: string } | null;
};

// Validate + store the ID document (and optional selfie) in the private bucket, then
// upsert the verification row to 'pending'. Self-declared DOB must be 18+ (the human
// reviewer confirms against the document).
export async function submitVerification(accountId: string, accountPublicId: string, input: SubmitInput): Promise<void> {
  const fullName = input.fullName.trim();
  if (fullName.length < 2) throw new Error('Enter your full legal name');
  if (!DOCUMENT_TYPES.includes(input.documentType as DocumentType)) throw new Error('Choose a valid document type');
  if (!input.consent) throw new Error('You must give consent to proceed');
  if (ageFromDob(input.dob) < 18) throw new Error('You must be 18 or older');

  const docPath = `${accountId}/document.${extForMime(input.document.mime)}`;
  await uploadObject('identity', docPath, input.document.buffer, input.document.mime);

  let selfiePath: string | null = null;
  if (input.selfie) {
    selfiePath = `${accountId}/selfie.${extForMime(input.selfie.mime)}`;
    await uploadObject('identity', selfiePath, input.selfie.buffer, input.selfie.mime);
  }

  await admin().from('identity_verification').upsert(
    {
      account_id: accountId,
      full_name: fullName,
      date_of_birth: input.dob,
      country: input.country,
      document_type: input.documentType,
      document_path: docPath,
      selfie_path: selfiePath,
      status: 'pending',
      consent_given: true,
      consent_at: new Date().toISOString(),
      rejection_reason: null,
      submitted_at: new Date().toISOString(),
      decided_at: null,
      decided_by: null,
    },
    { onConflict: 'account_id' },
  );

  await writeAudit({ actorId: accountId, action: 'identity.submitted', targetType: 'account', targetId: accountPublicId });
  await emit('IDENTITY_SUBMITTED', { account_id: accountId });
}

export type PendingVerification = {
  id: string;
  account: string;
  full_name: string;
  date_of_birth: string;
  age: number;
  country: string | null;
  document_type: string;
  submitted_at: string;
  document_url: string | null;
  selfie_url: string | null;
};

// Operator/reviewer queue. Signs the private doc/selfie for short-lived viewing.
export async function listPendingVerifications(): Promise<PendingVerification[]> {
  const { data } = await admin()
    .from('identity_verification')
    .select('id, full_name, date_of_birth, country, document_type, document_path, selfie_path, submitted_at, account:account_id ( public_id )')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });

  const rows = (data ?? []) as unknown as {
    id: string; full_name: string; date_of_birth: string; country: string | null;
    document_type: string; document_path: string; selfie_path: string | null; submitted_at: string;
    account: { public_id: string } | null;
  }[];

  return Promise.all(rows.map(async (r) => ({
    id: r.id,
    account: r.account?.public_id ?? '',
    full_name: r.full_name,
    date_of_birth: r.date_of_birth,
    age: ageFromDob(r.date_of_birth),
    country: r.country,
    document_type: r.document_type,
    submitted_at: r.submitted_at,
    document_url: await signedUrl('identity', r.document_path),
    selfie_url: r.selfie_path ? await signedUrl('identity', r.selfie_path) : null,
  })));
}

// Approve → set account.age_verified_at (the publish gate). Reject → clear it and
// record the reason. Notifies the creator (SMS/email, best-effort).
export async function decideVerification(id: string, deciderId: string, approve: boolean, reason: string | null): Promise<void> {
  const { data: row } = await admin().from('identity_verification').select('account_id, status').eq('id', id).maybeSingle();
  if (!row) throw new Error('Verification not found');
  const v = row as { account_id: string; status: string };

  await admin().from('identity_verification').update({
    status: approve ? 'approved' : 'rejected',
    rejection_reason: approve ? null : reason,
    decided_at: new Date().toISOString(),
    decided_by: deciderId,
  }).eq('id', id);

  await admin().from('account').update({ age_verified_at: approve ? new Date().toISOString() : null }).eq('id', v.account_id);

  await writeAudit({ actorId: deciderId, action: approve ? 'identity.approved' : 'identity.rejected', targetType: 'account', targetId: v.account_id });
  await emit(approve ? 'IDENTITY_APPROVED' : 'IDENTITY_REJECTED', { account_id: v.account_id });
  await notifyCreator(v.account_id, approve, reason);
}

async function notifyCreator(accountId: string, approve: boolean, reason: string | null): Promise<void> {
  const smsOn = smsConfigured();
  const emailOn = emailConfigured();
  if (!smsOn && !emailOn) return;
  try {
    const { data } = await admin().from('account').select('phone_enc, email').eq('id', accountId).maybeSingle();
    const acc = data as { phone_enc: string | null; email: string | null } | null;
    if (!acc) return;
    const text = approve
      ? 'Your identity has been verified — you can now publish content.'
      : `Your identity verification was declined${reason ? `: ${reason}` : '.'} Please resubmit.`;
    if (smsOn && acc.phone_enc) await sendSms(decryptPhone(fromBytea(acc.phone_enc)), `Content Box: ${text}`);
    if (emailOn && acc.email) await sendEmail(acc.email, approve ? 'Identity verified' : 'Identity verification declined', text);
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[identity] creator notification skipped');
  }
}
