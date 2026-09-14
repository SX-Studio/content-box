-- Allow an invitation to grant box_admin.
--
-- box_membership.role and account_role.role already permit 'box_admin' — createBox
-- has always written it for the box's first admin. Only the invitation CHECK was
-- narrower, so an admin could invite creators and users but never another admin.
--
-- acceptInvitation upserts target_role into both tables generically, so widening this
-- constraint is the whole change on the data side.

alter table public.invitation drop constraint if exists invitation_target_role_check;
alter table public.invitation
  add constraint invitation_target_role_check
  check (target_role in ('box_admin', 'creator', 'user'));
