import { requireAdminRole } from '@/lib/admin-stepup';

// Gate the moderation console by role only: must be signed in and be an
// operator/moderator. No fingerprint step-up, so operators can open the console
// directly — including on a desktop with no biometric authenticator. The sensitive
// admin backend (/admin: payouts, operators, economics) still requires the passkey.
export const dynamic = 'force-dynamic';

export default async function ModerationLayout({ children }: { children: React.ReactNode }) {
  await requireAdminRole();
  return <>{children}</>;
}
