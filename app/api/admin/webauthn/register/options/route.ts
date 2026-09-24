import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { currentAccount, hasRole } from '@/lib/authz';
import { admin } from '@/lib/supabase/admin';
import { RP_NAME, rpId } from '@/lib/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const isAdmin = (await hasRole(account.id, 'platform_operator')) || (await hasRole(account.id, 'moderator'));
  if (!isAdmin) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const { data: creds } = await admin()
    .from('webauthn_credential')
    .select('credential_id, transports')
    .eq('account_id', account.id);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpId(),
    userName: account.public_id,
    userID: new TextEncoder().encode(account.id),
    attestationType: 'none',
    excludeCredentials: (creds ?? []).map((c) => ({
      id: c.credential_id as string,
      transports: (c.transports ?? []) as AuthenticatorTransport[],
    })),
    // No authenticatorAttachment: 'platform' pinned this to the device's own biometric,
    // which locks out an operator on a laptop without Touch ID — and with zero passkeys
    // enrolled that meant nobody could reach /admin to approve a creator's ID or a
    // payout. Leaving it open lets the browser offer the phone (QR / cross-device
    // passkey) or a security key too. userVerification stays required, so it is still
    // a biometric or PIN on whatever authenticator is chosen.
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });

  await admin().from('webauthn_challenge').insert({
    account_id: account.id,
    challenge: options.challenge,
    kind: 'register',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });

  return NextResponse.json(options);
}
