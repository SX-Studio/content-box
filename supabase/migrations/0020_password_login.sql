-- Optional password sign-in, alongside (never replacing) OTP.
--
-- Why optional: OTP stays the account-recovery path and the only way to sign in on a
-- fresh device with no password set. A password removes the per-SMS cost and the wait
-- for returning users; it is a convenience layer, not the root of trust.
--
-- Purely additive: existing accounts keep password_hash NULL and continue to sign in
-- by OTP exactly as before.

alter table public.account
  add column if not exists password_hash            text,
  add column if not exists password_set_at          timestamptz,
  -- Online-guessing defence. Counted per account and reset on any success; the lockout
  -- is what makes a slow credential-stuffing run against one account unprofitable.
  add column if not exists password_failed_attempts integer not null default 0,
  add column if not exists password_locked_until    timestamptz;

-- password_hash holds a self-describing scrypt string (scrypt$N$r$p$salt$hash), never
-- a plaintext or a reversible form. Nothing may read it back out over PostgREST: the
-- column is only ever touched by service-role code in the auth routes.
comment on column public.account.password_hash is
  'scrypt$N$r$p$salt_b64$hash_b64 — service-role only, never exposed to any client';

-- Finding the one locked-out account during an attack should not scan the table.
create index if not exists account_password_locked_idx
  on public.account (password_locked_until)
  where password_locked_until is not null;
