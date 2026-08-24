-- 0016 — Creator identity / age (18+) verification
-- Sensitive PII (ID document + selfie) lives in the private 'identity' storage
-- bucket; only the service role touches it, and reviewers see short-lived signed
-- URLs. One row per account (resubmission updates it in place).

create table if not exists public.identity_verification (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null unique references public.account(id) on delete cascade,
  full_name      text not null,
  date_of_birth  date not null,
  country        text,
  document_type  text not null check (document_type in ('passport','id_card','drivers_license')),
  document_path  text not null,
  selfie_path    text,
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  consent_given  boolean not null default false,
  consent_at     timestamptz,
  rejection_reason text,
  submitted_at   timestamptz not null default now(),
  decided_at     timestamptz,
  decided_by     uuid references public.account(id),
  created_at     timestamptz not null default now()
);
create index if not exists identity_verification_status_idx on public.identity_verification (status, submitted_at);

-- Denormalised gate flag: set on approval, cleared if a decision is reversed.
alter table public.account add column if not exists age_verified_at timestamptz;

alter table public.identity_verification enable row level security;
revoke all on public.identity_verification from anon, authenticated;
grant all on public.identity_verification to service_role;

-- Private bucket for identity documents. Service-role only (no public policies).
insert into storage.buckets (id, name, public)
  values ('identity', 'identity', false)
  on conflict (id) do nothing;
