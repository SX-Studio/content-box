-- 0019 — Email as a second, equally private login identifier.
-- Mirrors the phone model exactly: email_enc (AES-256-GCM) + email_hash (keyed HMAC
-- for equality lookup, domain-separated from phone hashes). No participant ever sees
-- another's email; only the platform can decrypt, and only server-side.
--
-- Phone becomes optional so an account may exist with email only, phone only, or
-- both — but never neither (the CHECK below). Existing rows all have a phone, so the
-- constraint is satisfied on apply. Purely additive: zero-downtime, no rename.
--
-- NOTE: account.email (0015) is the OPTIONAL plaintext *contact* address used for
-- notifications and is untouched here. The login identifier is email_enc/email_hash.

alter table public.account alter column phone_enc  drop not null;
alter table public.account alter column phone_hash drop not null;

alter table public.account add column if not exists email_enc         bytea;
alter table public.account add column if not exists email_hash        text unique;
alter table public.account add column if not exists email_verified_at timestamptz;

alter table public.account drop constraint if exists account_has_login_identifier;
alter table public.account
  add constraint account_has_login_identifier
  check (phone_hash is not null or email_hash is not null);

comment on column public.account.email_enc  is 'Encrypted login email (AES-256-GCM). Never store or log plaintext.';
comment on column public.account.email_hash is 'Keyed HMAC of the normalised login email, domain-separated from phone_hash; enables equality lookup without decryption.';

-- otp_challenge: record which channel a code went out on. phone_hash now holds the
-- HMAC of whichever identifier the challenge is for. Existing rows default to 'sms'.
alter table public.otp_challenge
  add column if not exists channel text not null default 'sms'
  check (channel in ('sms','email'));

comment on column public.otp_challenge.phone_hash is
  'Keyed HMAC of the login identifier for this challenge: the E.164 phone when channel=sms, the normalised email when channel=email.';
