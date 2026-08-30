# Content Box — Project Memory

Read this at the start of every session. Update as state changes.

## What this is
A **temporary multi-creator content rental marketplace** (working name "Content Box").
Creators drop content into a shared **Box**; users browse one central feed, pay with
**tokens**, and **rent** an item for **24 hours** — access then **expires** automatically.
Core loop: **DROP → DISCOVER → RENT → EXPIRE**.

Standalone product; optional SecretXperience integration is a later phase. This is a
**separate repo + separate Supabase project** from SecretXperience.

## Locked decisions (2026-08)
- **Standalone**: own repo (`SX-Studio/Secret-xperience-Chat-Box`) + own Supabase
  project (`jpnnzxnvubrosjjcbkmn`). Fully separate from SX.
- **Stack**: Next.js 14 App Router + TypeScript + Supabase (Postgres/RLS/Storage/cron).
- **Modules, not microservices** (yet): the 11 logical services live as `lib/` modules
  in one app, with an append-only `events` table standing in for Kafka. Extract real
  services only when scale demands it.
- **SMS/OTP**: provider-agnostic adapter, **stub in Phase 1** (codes log to console).
  Real provider (Twilio/MessageBird/Vonage) plugs in later without app changes.
- **Token economics (DB-configurable, in `app_config`)**: €10 = 1000 tokens
  (100 tok = €1), 80/20 creator/platform split, €50 payout threshold, 24h rental.
- **Payments**: ⚠️ **NOT Stripe** — Stripe prohibits adult content. Phase 3 needs an
  adult-friendly PSP + a token/legal analysis (separate compliance track, start early).

## Privacy model (non-negotiable)
Pseudonymous **between participants**, transparent **to the platform**.
- Participants identify each other only by public IDs (`USR-`/`CRT-`/`BOX-`/`CNT-`).
- **No participant ever sees another's phone number.** Only platform operators can
  decrypt a phone, and every such access is audit-logged.
- Phone stored `phone_enc` (AES-256-GCM) + `phone_hash` (keyed HMAC for lookup).

## The 24h rental rule (core)
Every rental has its OWN timer, anchored to the purchase moment:
`purchased_at = now()` (server clock), `expires_at = purchased_at + 24h`, set in the
SAME transaction as the wallet debit. The UI countdown is decorative; the server
re-checks `active AND now() < expires_at` on every view before issuing a signed URL.

## Phase status
- **Phase 1 — Identity & Box foundation** ← in progress
  - ✅ Chunk 1: project scaffold + migrations `0001`–`0005` (account, account_role, box,
    box_membership, invitation, audit_log, events, app_config) + RLS + lib helpers
    (supabase clients, ids, crypto, config) + tests (ids, crypto).
  - ✅ Chunk 2: OTP auth. Migration `0006` (otp_challenge). `lib/auth/*` (adapter +
    stub sender + otp hash/verify), `lib/session*` (signed cookie), `lib/accounts`
    (find-or-create; first account bootstraps as platform_operator), `lib/authz`
    (currentAccount/roles/hasRole), `lib/audit`, `lib/events`, `lib/ratelimit`.
    Routes: `POST /api/auth/otp/start`, `POST /api/auth/otp/verify`,
    `POST /api/auth/logout`, `GET /api/me`. Tests (session, otp) — 15 passing total.
  - ✅ Chunk 3: boxes API. `lib/boxes` (createBox — operator-only, creator becomes
    box_admin; listBoxesForAccount; getBoxForAccount; validateBoxName). Routes
    GET/POST `/api/boxes`, GET `/api/boxes/[id]`.
  - ✅ Chunk 4: invitations API (closes the Phase 1 loop). `lib/invitations`
    (generate/hash token, createInvitation — box_admin/operator, phone-bound,
    72h TTL from app_config; acceptInvitation — session + phone-match required,
    idempotent upsert of membership + role, single-use). Routes
    POST `/api/boxes/[id]/invitations`, POST `/api/invitations/[token]/accept`.
    Invite link returned in `dev` field only while OTP_SENDER=stub. 20 tests total.
  - **Phase 1 core loop is complete**: operator logs in (OTP) → creates box →
    invites creator/user → invitee OTP-verifies → accepts → joins box. All audited
    + events emitted. Migrations `0001`–`0006` live on Supabase.
- **Phase 2 — content upload & processing, blurred feed** ← in progress
  - ✅ Chunk 1: content schema. Migration `0007` (content, content_asset + storage
    buckets: `master` private, `preview` public; RLS deny-by-default). `lib/content`
    (validate title/price, mime/size limits), `lib/media` (sharp: thumbnail + blurred
    preview), `lib/storage` (service-role upload + public preview URL). Routes:
    POST `/api/content` (creator upload → master private + blurred/thumb previews →
    row; auto-approved in Phase 2, moderation gate is Phase 4), GET
    `/api/boxes/[id]/feed` (member-gated; returns blurred previews, never master).
    Tests: validateContentInput/extForMime (24 total). Migration applied to Supabase.
  - ✅ Chunk 2: upload + feed UI. `/box/[id]` page — Drop-content form (image +
    title + price) for creators/box-admins/operators, and the blurred-preview feed
    grid for all members (Rent button disabled until Phase 3). Dashboard box cards
    link to the feed.
  - **Phase 2 complete.** Migrations `0001`–`0007` live.
  - ⏳ Next: Phase 3 (wallet, tokens, rental engine, payouts).
- **Phase 3 — wallet, tokens, rental engine, payouts** ← in progress
  - ✅ Chunk 1: wallet + immutable ledger. Migration `0008` (wallet, ledger_entry,
    earning + `wallet_apply()` SECURITY DEFINER function — atomic, row-locked,
    idempotent, overspend-proof; EXECUTE revoked from anon/authenticated so only
    service_role can call it — advisor-flagged, fixed). `lib/wallet` (getBalance,
    applyWallet via rpc, getLedger, validateTopUpAmount). Routes GET `/api/wallet`,
    POST `/api/wallet/topup` (dev top-up, gated to OTP_SENDER=stub). Wallet panel in
    dashboard. Ledger function verified live (idempotency + overspend). 26 tests.
  - ✅ Chunk 2: rental engine (the heart). Migration `0009` (rental table + partial
    unique one-active-per-user+content; `rent_content()` SECURITY DEFINER — atomic
    debit via wallet_apply + earning split + rental insert; EXECUTE locked to
    service_role). Timer anchored to purchase: `expires_at = now()+rental_hours`.
    `lib/rentals` (rentContent, viewContent → on-access signed URL of the master,
    listMyRentals). Routes POST `/api/content/[id]/rent`, GET
    `/api/content/[id]/view`, GET `/api/rentals/my`. UI: feed Rent button works →
    unlock via signed URL + live countdown; `/rentals` page. Verified live: 250
    debit → 750, 80/20 split, ~24h expiry, idempotent re-rent (no double charge).
    Core loop DROP→DISCOVER→RENT→EXPIRE complete. 26 tests; advisor clean.
  - ⏳ Next: creator earnings dashboard + payout requests (€50 threshold) + the
    expiry sweep job (on-access check already enforces expiry).
- (in progress above) Phase 3 — wallet, tokens, rental engine, payouts
- **Phase 4 — moderation console, AI screening, reports** ← in progress
  - ✅ Chunk 1: moderation backbone. Migration `0010` (moderation_case, report; RLS
    deny-by-default). `lib/moderation` (screenImage stub → low risk; createModerationCase;
    decideContent approve/reject/suspend/delete; listModerationQueue;
    moderationOriginalUrl — signed master URL, audited). `lib/reports` (createReport,
    listReports, resolveReport, validateReportReason). Upload now screens → low risk
    auto-approves, else status 'pending' (moderation case created). viewContent tie-in:
    only 'approved' content is viewable even with an active rental. Routes: moderation
    queue/decision/original/reports/resolve (moderator-gated), POST /api/reports (any
    user). UI: `/moderation` console (content queue + reports, view original, decision
    buttons), dashboard link, feed "⚑ Report" button. 28 tests; advisor clean.
  - ⏳ Next (finish the product): Phase 3 leftovers — creator earnings dashboard +
    payout requests (€50) + pg_cron expiry sweep; then account restrict/suspend in console.

## Architecture quirks / patterns
- **All Phase 1 DB access via server routes using the service-role client** (`lib/supabase/admin.ts`).
  RLS is enabled + deny-by-default for anon/authenticated as the second lock.
- `import 'server-only'` guards server modules; vitest aliases it to a stub so pure
  helpers stay testable.
- Next 14: `cookies()` is **async** (unlike SX's Next 13.5.1).
- Public IDs via `lib/ids.ts` (Crockford base32, no I/L/O/U).

## Constraints / don'ts
- Never store or log a plaintext phone number.
- Never expose the service-role key or `lib/crypto` / `lib/supabase/admin` to the client.
- Never wire Stripe for token purchase in this product.
- Work in reviewable chunks: analyse → build → test → security check → report → next.
- Don't break existing functionality without explicit permission.

## Useful files
- `supabase/migrations/` — schema + RLS (`0001`–`0005`)
- `lib/supabase/{admin,server,client}.ts` — service-role / SSR / browser clients
- `lib/crypto.ts` — phone encrypt/decrypt + HMAC + E.164 normalise
- `lib/ids.ts` — public ID generation
- `lib/config.ts` — reads `app_config` (token defaults)
- `tests/` — vitest (unit +, later, integration/security)
- `docs/twilio-setup.md` — switch OTP delivery from stub to real Twilio SMS + error-code fixes

## How to run
```bash
npm install
cp .env.example .env.local   # Supabase keys + generated crypto keys
npm run test
npm run dev
```
