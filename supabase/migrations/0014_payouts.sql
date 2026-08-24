-- 0014 — Creator payouts
-- Creator earnings accrue in public.earning (creator_tokens, state 'available').
-- A payout reserves all currently-available earnings for a creator into one
-- request; an operator then marks it paid (money sent off-platform) or rejects it
-- (earnings are released back to available). Both transitions are atomic RPCs,
-- service_role only, mirroring wallet_apply / rent_content.

create table if not exists public.payout (
  id            uuid primary key default gen_random_uuid(),
  public_id     text unique not null,                    -- PAY-…
  creator_id    uuid not null references public.account(id) on delete cascade,
  amount_tokens int not null check (amount_tokens > 0),
  eur_cents     int not null check (eur_cents >= 0),
  status        text not null default 'requested'
                check (status in ('requested','paid','rejected')),
  note          text,
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.account(id),
  created_at    timestamptz not null default now()
);
create index if not exists payout_creator_idx on public.payout (creator_id, status);
create index if not exists payout_status_idx on public.payout (status, requested_at);

-- Link earnings to the payout that reserved them. Available balance excludes any
-- earning already attached to a payout.
alter table public.earning
  add column if not exists payout_id uuid references public.payout(id) on delete set null;
create index if not exists earning_payout_idx on public.earning (payout_id);

alter table public.payout enable row level security;
revoke all on public.payout from anon, authenticated;
grant all on public.payout to service_role;

-- Request a payout: reserve every available, unreserved earning for the creator
-- into a new request. Enforces the payout threshold (payout_threshold_eur).
create or replace function public.request_payout(p_creator uuid, p_public_id text)
returns public.payout
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tpe       numeric := coalesce((select value::numeric from public.app_config where key = 'tokens_per_euro'), 100);
  v_thr_eur   numeric := coalesce((select value::numeric from public.app_config where key = 'payout_threshold_eur'), 50);
  v_threshold int := ceil(v_thr_eur * v_tpe);
  v_available int;
  v_payout    public.payout;
begin
  select coalesce(sum(creator_tokens), 0) into v_available
    from public.earning
    where creator_id = p_creator and state = 'available' and payout_id is null;

  if v_available < v_threshold then
    raise exception 'BELOW_THRESHOLD: % available, need %', v_available, v_threshold using errcode = 'P0001';
  end if;

  insert into public.payout (public_id, creator_id, amount_tokens, eur_cents)
    values (p_public_id, p_creator, v_available, round(v_available / v_tpe * 100)::int)
    returning * into v_payout;

  update public.earning
    set payout_id = v_payout.id
    where creator_id = p_creator and state = 'available' and payout_id is null;

  return v_payout;
end;
$$;

-- Decide a requested payout. p_paid = true → status 'paid', its earnings become
-- 'withdrawn'; false → status 'rejected', its earnings are released to available.
create or replace function public.decide_payout(p_payout uuid, p_decider uuid, p_paid boolean, p_note text)
returns public.payout
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.payout;
begin
  select * into v_payout from public.payout where id = p_payout for update;
  if v_payout.id is null then
    raise exception 'PAYOUT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_payout.status <> 'requested' then
    raise exception 'PAYOUT_ALREADY_DECIDED' using errcode = 'P0003';
  end if;

  if p_paid then
    update public.earning set state = 'withdrawn' where payout_id = p_payout;
    update public.payout
      set status = 'paid', note = p_note, decided_at = now(), decided_by = p_decider
      where id = p_payout returning * into v_payout;
  else
    update public.earning set payout_id = null where payout_id = p_payout;
    update public.payout
      set status = 'rejected', note = p_note, decided_at = now(), decided_by = p_decider
      where id = p_payout returning * into v_payout;
  end if;

  return v_payout;
end;
$$;

revoke all on function public.request_payout(uuid, text) from anon, authenticated;
revoke all on function public.decide_payout(uuid, uuid, boolean, text) from anon, authenticated;
grant execute on function public.request_payout(uuid, text) to service_role;
grant execute on function public.decide_payout(uuid, uuid, boolean, text) to service_role;
