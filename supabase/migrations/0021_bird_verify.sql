-- Bird Verify: delegate OTP code generation and checking to Bird.
--
-- With OTP_SENDER=bird-verify we no longer generate or store the code — Bird does,
-- and we ask it whether a submitted code matches. The challenge row still exists so
-- rate limiting, the attempt cap and the audit trail keep working identically; it
-- simply carries no code_hash.
--
-- Additive and reversible: existing rows are backfilled to 'local' and the local path
-- is unchanged, so flipping OTP_SENDER back needs no migration.

alter table public.otp_challenge
  add column if not exists provider        text not null default 'local',
  -- Bird's own handle for the verification (vrf_...). Not a secret, and not the code.
  add column if not exists provider_ref    text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'otp_challenge_provider_check'
  ) then
    alter table public.otp_challenge
      add constraint otp_challenge_provider_check check (provider in ('local', 'bird_verify'));
  end if;
end $$;

-- The code lives at Bird in verify mode, so there is nothing to hash locally.
alter table public.otp_challenge alter column code_hash drop not null;

-- A local challenge must still carry its hash — dropping NOT NULL above must not
-- quietly allow an unverifiable local challenge.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'otp_challenge_local_needs_hash'
  ) then
    alter table public.otp_challenge
      add constraint otp_challenge_local_needs_hash
      check (provider <> 'local' or code_hash is not null);
  end if;
end $$;
