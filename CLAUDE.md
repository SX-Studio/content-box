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
- **SMS/OTP**: provider-agnostic adapter (`OtpSender`), selected by `OTP_SENDER`
  (`stub` | `twilio` | `bird`). **Bird is the preferred real provider** (2026-09-11;
  Twilio kept as a fallback because it "has been giving complications"). Both real
  senders fall back to the stub when unconfigured. `OTP_SENDER=bird` also carries
  notification SMS. Docs: `docs/bird-setup.md`, `docs/twilio-setup.md`.
- **Token economics (DB-configurable, in `app_config`)**: €10 = 1000 tokens
  (100 tok = €1), 80/20 creator/platform split, €50 payout threshold, 24h rental.
- **Payments**: ⚠️ **NOT Stripe** — Stripe prohibits adult content. Phase 3 needs an
  adult-friendly PSP + a token/legal analysis (separate compliance track, start early).

## Privacy model (non-negotiable)
Pseudonymous **between participants**, transparent **to the platform**.
- Participants identify each other only by public IDs (`USR-`/`CRT-`/`BOX-`/`CNT-`).
- **No participant ever sees another's phone number or login email.** Only the
  platform can decrypt either, server-side, and every such access is audit-logged.
- Phone stored `phone_enc` (AES-256-GCM) + `phone_hash` (keyed HMAC for lookup).
- Login email stored the same way: `email_enc` + `email_hash` (HMAC domain-separated
  with an `email:` prefix so it can never collide with a phone hash). An account has
  phone, email, or both — never neither (DB CHECK). ⚠️ Distinct from `account.email`
  (0015), the OPTIONAL plaintext *contact* address for notifications — see the
  2026-09-11 log for the follow-up to encrypt that too.

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

## Session log — 2026-09-13 (box invitations actually deliver)
Branch `claude/invite-sms`. No migration. Three real bugs, not a missing feature.

1. **Wrong transport.** The route called `getSender().send(phone, 'Join on Content Box:
   /invite/…')`. `OtpSender.send(phoneE164, code)` takes a **code** and wraps it in its
   own copy, so the invitee would have received *"Your Content Box code is Join on
   Content Box: /invite/abc. It expires in a few minutes. Do not share it."* — a garbled
   message telling them not to share the link they need to open. Now uses
   **`sendSms()`**, which carries arbitrary text and is fire-and-forget.
2. **Relative link.** `/invite/${token}` has no origin and is unusable in an SMS. Now
   `${env.appOrigin()}/invite/${token}`.
3. **Silently unsent.** `lib/sms.ts` `useBird()` matched only `'bird'`, so under
   `OTP_SENDER=bird-verify` every notification SMS fell through to the unconfigured
   Twilio branch and returned false. Verify only ever sends a verification code, so
   invites, payout and identity texts must still take the plain Bird send — `useBird()`
   now matches `bird-verify` too. **This silently affected payout and identity texts as
   well, not just invites.**

- The response now returns `link` to the **inviter** always (was stub-only, which left
  no delivery path at all once a real sender was selected) plus `smsSent`, so the UI can
  fall back to "share this link" when delivery fails. Safe: the token is phone-bound and
  `acceptInvitation` still requires the invitee's own verified number.
- ⚠️ **Invite SMS depends on the plain-SMS path, which Verify does NOT cover.** It needs
  the Bird key's own SMS send scope plus an approved `BIRD_FROM` — the gate `bird-verify`
  was chosen to sidestep. Until that is granted, `smsSent:false` and the `link` fallback
  is the working path. Check the key's SMS scope the way `verify:write` was found.
- Tests: `tests/invite-sms.test.ts` (5), incl. a guard that the body is carried verbatim
  and never reworded as a code. **167 passing**; `tsc` clean; `next build` compiles.

## Session log — 2026-09-14 (box admins: grantable + creator-owned boxes)
Branch `claude/box-admin-roles`. Migration `0022_invite_box_admin.sql` — **needs
applying**; strictly widens a CHECK, so no existing row can violate it.

- **Admins can now promote a number to box admin.** Only the invitation CHECK was
  narrow (`creator`/`user`): `box_membership.role` and `account_role.role` already
  permitted `box_admin` — `createBox` has always written it for a box's first admin —
  and `acceptInvitation` upserts `target_role` generically into both. So widening the
  constraint plus the role guard was the entire change; the accept path is untouched.
  ⚠️ **Appointing a box admin is PLATFORM-OPERATOR ONLY.** A box admin invites creators
  and users into their own box but cannot appoint another admin — otherwise one
  careless admin multiplies into several and operators lose control of who runs a box.
  Enforced server-side in the invitations route; the UI simply hides the option from
  non-operators. `platform_operator` and `moderator` remain ungrantable through a box
  invite at all. Both rules pinned by tests.
- **Creators can create boxes and own what they create.** `POST /api/boxes` was
  operator-only; it now also accepts a creator. No change was needed to make them the
  admin — `createBox` already writes `box_admin` membership + role for whoever creates
  it. Note `hasRole(id, 'creator')` with no boxId asks "a creator anywhere", i.e. an
  onboarded creator rather than any signed-in stranger.
- Dashboard shows the Create Box form to creators as well as operators; the invite
  form gained a "box admin" role option.
- Tests: `tests/box-roles.test.ts` (7). `tsc` clean; `next build` compiles.

## Session log — 2026-09-14 (neon theme — token layer)
Branch `claude/neon-theme`. No migration. Implemented from the Claude Design handoff
bundle "Classic Neon Templates" (project `Neon templates for content24market`).

- **The app is now DARK-ONLY.** The design is dark-only, so the light `:root` default
  and both the `prefers-color-scheme` and `[data-theme]` variants were removed — there
  is one theme. `color-scheme: dark` set so form controls follow.
- **A token swap re-skins all 14 routes at once.** `app/globals.css` was already fully
  token-driven, so the palette maps straight across: `--bg/--surface*` → the neon
  grounds, `--ink*` → the violet-tinted text ramp, **`--ember` → `#ff2d9b` magenta**,
  `--teal` → `#22e1ff` cyan, `--gold` → `#8b5cf6` violet. The existing button rule
  `linear-gradient(135deg, var(--ember), var(--ember-d))` reproduces the design's
  primary CTA (`140deg, a2 → vi`) **without touching the rule**.
- ⚠️ **One deliberate deviation from the design.** Its `--ink-3` is `#6d6197`, which
  scores **3.49:1** on `--surface` — below AA for the 13px `.dim` text that uses it,
  and worse than the 4.39:1 it replaced. Lifted to `#8173b3` (4.62:1) on the same hue
  and saturation. Every other token clears AA body; contrast was computed, not eyeballed.
- **`--glow`** carries the design's `--nx-g` glow multiplier into `--shadow`. Set it to
  `0` to flatten every glow at once without editing a shadow.
- `body` gains the design's two ambient washes (violet top-left, cyan top-right).
- **`app/box-ui.tsx` `GRADS`/`AV_COLORS` re-picked.** Deterministic per-identity
  colours, hardcoded so they stay stable per creator — which also means the theme swap
  cannot reach them. They were still ember/teal/gold.
- Fonts: `--serif` is now **Poppins** (was Fraunces); Poppins was already loaded, and
  Fraunces — now unreferenced — was dropped from the `layout.tsx` font request.
- Brand assets `public/brand/content24-{logo,brand}.png` imported. `public/icon-512.png`
  in the bundle is **byte-identical** to the repo's (the design imported it from here).
- ⚠️ **`support.js` in the bundle was NOT ported.** It is the Claude Design canvas
  runtime (`dc-runtime`, a React renderer for `.dc.html`) — prototype scaffolding, not
  app code.
- **Stage 2 (not done):** per-screen detail — glow treatments, the icon-512 badge mark
  the design puts on every screen, brand-asset placement, and screen-specific
  components across the 14 routes. The bundle's screen map lists the repo file for each.
- Handoff bundle extracted at `scratchpad/neon/` (session-local; re-upload if needed).

## Session log — 2026-09-14 (landing: real buttons, /login not /app, and the blur budget)
Branch `main`. No migration.

- **Every landing CTA goes to `/login` again, not `/app`.** Pointing them at `/app` was
  my overcorrection: the landing should offer the sign-in door, not drop a visitor into
  the product. `/login` now forwards an already-signed-in visitor to `/app` — **only
  when there is no `next` param**, because a caller that names a destination wants a
  fresh sign-in, which is exactly how `/account/password` earns its 15-minute
  fresh-auth proof. Redirecting that away would re-create the dead end just fixed.
- **The phone mockup's `Log in` / `Register` pills are real links now.** They were
  `<div>`s inside a `role="img"` wrapper, deliberately inert. The wrapper's `role="img"`
  had to go with them (it hides descendants from assistive tech); the non-interactive
  bezel layers carry `aria-hidden` individually instead. ⚠️ `.nx-084`/`.nx-085` needed
  **`display:block`** — they set `width:100%`, which an inline `<a>` ignores, so without
  it both pills collapse. Verified by clicking all six controls: 209×42 and 209×47 hit
  areas, all six land on `/login`.
- ⚠️ **Performance: measure, but know what this container cannot measure.** Scrolling
  ran at **12.3 fps at 390px and 4.8 fps at 1440px**. Ablation found the whole cost in
  the ambient backdrop (removing `.nx-002` → 54 fps, a 10× jump) and `filter: blur()`
  within it (2.5×), **not** the animations (killing all 44 moved 5.7 → 6.3).
  - Shipped: `nxPrism` no longer animates `filter` (a filter animation can never be
    composited, on any hardware), and **14 layers had their blur radius cut** —
    70-80px → 28-34px on the blobs, blur dropped entirely from the two conic layers
    (150vmax and 110vmax, several megapixels, and a conic gradient needs none).
    Result **17.3 fps at 390px and 6.8 at 1440px — ~1.4×**, and the page is still
    pixel-identical to the reference at pixelmatch's perceptual threshold: max channel
    deviation 17/255 desktop, 30/255 mobile, mean 1.3-2.1. The blurs were softening
    gradients that were already soft.
  - **Reverted, deliberately: `will-change`, `backface-visibility`, `contain:paint`.**
    These are GPU hints and this container renders in software (SwiftShader), where the
    extra compositor layers are pure cost — they measured **worse** (390px 12.3 → 8).
    They may well help on real hardware; that is exactly why they were not shipped.
    **Do not add compositor hints here without a device that can measure them.**

## Session log — 2026-09-14 (password page: a state with no way out)
Branch `main`. No migration — `0020` is applied; the four `account.password_*` columns
were verified present live, so the DB was never the problem.

- ⚠️ **The bug: signed in, no password yet, `cb_freshauth` expired → a form that could
  only 403.** The page computed `needsCurrent = hasPassword && !freshAuth`, and rendered
  the "or log in met een code" escape hatch *only* inside that branch. A user with **no**
  password and a stale session fell outside it: they got the ordinary "set a password"
  form with no notice and no link, filled it in, and the server refused with *"Sign in
  again with a code to set a password."* — an instruction the page gave them no way to
  follow. The 15-minute fresh-auth TTL against a 30-day session means **every** user who
  did not set a password within 15 minutes of signing in landed here.
- Fix: a third state, `mustReauth = !hasPassword && !freshAuth`, renders the reason and a
  **"Stuur me een code"** button to `/login?next=/account/password` instead of the form.
  The gate itself is unchanged and still correct — a 30-day cookie must not mint a
  permanent credential. Verified by rendering all three states with the API stubbed:
  stale+no-password → 0 password fields + the link; fresh → the 2-field form, no link;
  has-password+stale → 3 fields + the link.
- **Open redirect closed while in there.** `app/login/page.tsx` accepted any `next`
  passing `n.startsWith('/')` — which `//evil.com` does. The router follows that
  off-site as a protocol-relative URL, and `/account/password` now links into `next`,
  so the hole was newly reachable. Now also requires `!n.startsWith('//')`.

## Session log — 2026-09-14 (neon landing page — exact)
Branch `claude/neon-landing`, off `claude/neon-screens`. No migration.

- Implemented from the second handoff bundle, `design_handoff_neon_landing/`, which
  unlike the first ships a **drop-in React component + CSS with byte-identical values**.
  Its README says to prefer copying over re-deriving by eye, so `neon-landing.css` was
  copied verbatim (md5 match) and only the DOM was adapted.
- **`app/page.tsx` is now a four-line wrapper** around `app/neon-landing/NeonLanding.tsx`.
  The hand-built `.c24` landing it replaced is gone. `app/neon-landing/` has no
  `page.tsx`, so it adds no route.
- ⚠️ **Two bugs in the handoff, both fixed here — do not "restore" them:**
  1. Each `<i>` carried **two `className` attributes** (`"ti ti-lock"` and `"nx-071"`),
     which TypeScript rejects. Merged into one.
  2. The reference styles anchors inline; the drop-in converted them to single-class
     rules but kept the base rule as `.nx-root a` (0,1,1), which **outranks** every
     `.nx-061`…`.nx-190` colour (0,1,0). Nav, footer, both store buttons and the
     Download App pill all rendered cyan. Base rules are now `:where(.nx-root) a`,
     matching the reference's bare `a {}` specificity.
- ⚠️ **`.nx-root` pins `line-height:normal`.** The reference renders on a bare document;
  `globals.css` sets `body{line-height:1.55}`, which inflated every metric on the page.
- **Verified, not assumed:** reference and route captured side by side in headless
  Chromium with real Poppins/IBM Plex and the real icon font, then pixel-diffed —
  **0 differing pixels at 1920/1440/1280/1024/834/768/600/430/390/360/320px**, no
  horizontal overflow at any of them. A DOM probe also matched all 197 nodes on
  geometry, colour, gradient, shadow, transform, filter and type. Harness in the
  session scratchpad (`fdiff.mjs`, `shot2.mjs`); it needs a local `next start` on 3210
  and the reference served on 3211, and it fulfils the two CDN stylesheets from disk
  because this container cannot reach them.
- **Icons: self-hosted, not the CDN.** `public/fonts/tabler-icons-subset.woff2` is the
  seven glyphs this page uses, subset with `pyftsubset` — **2 KB from 462 KB**. The
  `@font-face` and the seven `:before` rules live in `neon-landing.css` scoped to
  `.nx-root`, so no other page gains an icon-font dependency. This keeps the stage-2
  decision intact: a jsDelivr request from the app is exactly what
  `docs/data-handling-policy.md` says has to be earned. The only third-party request the
  landing makes is the Google Fonts stylesheet that was already in the root layout.
- **Added beyond the handoff** (neither changes the default rendering — re-diffed at 0):
  `@media (prefers-reduced-motion: reduce)` holds all 15 ambient animations at their
  first frame and drops `--nx-g` to `.6`; `.nx-176`/`.nx-182` carry a `vw` `font-size`
  before the `cqw` one, so browsers without container queries (Safari < 16) get a sized
  headline instead of a discarded declaration.
- ⚠️ **Entry points into the app: keep all four.** The landing it replaced had four
  links to `/login` (nav pill, hero CTA, both store buttons); this one first shipped with
  two, and the two most prominent — the hero store badges — were inert `#download`
  anchors. The user could not find their boxes from the homepage. All four now point at
  **`/app`**, which is strictly better than `/login`: signed out it redirects to
  `/login?next=/app`, signed in it lands straight on the boxes. The nav pill reads
  **"Open the app"**, not the design's "Download App" — a signed-in user does not click
  "Download App" to reach their own content. That is the **only** departure from the
  reference: 647 px inside a 94×38 box at the nav pill; the rest of the page is still
  pixel-identical at every width. Footer → the five real `/legal/*` routes (all 200).
  The phone's
  `Log in` / `Register` pills stay inert: they are decoration inside a mockup, and the
  mockup is one labelled `role="img"` so they are not announced as controls.
- Nav copy stays Dutch over an English hero, as the handoff shipped it — its README
  says not to normalise that without asking.

## Session log — 2026-09-14 (neon screens — stage 2)
Branch `claude/neon-screens`. Follows the token pass. No migration.

- **The design is a RE-SKIN of the existing app, not new layouts.** Its own `github.md`
  says copy, token amounts and package tiers were "lifted from the real source", and it
  shows: `/wallet` and `/app` already render `◈ {balance}`, `≈ €12.40 · 100 tokens = €1`,
  `Koop tokens` and `tokens · transactie-ledger` **verbatim**. So most of stage 2 was
  palette and chrome, not rebuilding screens.
- **Component layer** in `globals.css` — the design ships 678 inline styles and *zero*
  classes, so the repeated patterns are named once: `.brand-mark`, `.wash`, `.seg`,
  `.code-cell`, `.stat`, `.gradtext`. ⚠️ Artboard device chrome (phone bezel, fake
  status bar with wifi/battery, screen number plates) is **deliberately not
  reproduced** — that is framing around the mockups, not product UI.
- ⚠️ **Corrected a token-pass assumption:** the design's CTAs are **dark text
  (`#05030c`) on accent→lighter-accent**, not white on accent→violet. `button` now
  matches; `.alt` is the cyan CTA (the design's most common) and `.go` the green one.
- **Screens applied:** login (brand mark + segmented control + six code cells), invite,
  password, admin unlock. The code cells are decorative — the real input sits over them
  at `opacity:0`, so paste, keyboard and one-time-code autofill still work.
- **`BottomNav` already existed** in `box-ui.tsx` with the design's exact four tabs and
  inline SVGs; it only needed the cyan active state and the deep ground. A duplicate
  `.botnav` block was written and then removed — check `box-ui.tsx` before adding
  shared UI, it holds more than its name suggests.
- **Hardcoded colours swept app-wide.** `app/page.tsx` had its OWN local token block
  (`--pink/--orange/--cyan/...`) that the global swap could never reach; the design's
  landing uses **no orange at all**, so those are retired to violet and light cyan.
  Also cleared: old gold in the admin pages, ember-browns in `box-ui`, the feed
  placeholder gradient.
- **Copy follows the design into Dutch** on the screens touched. The design took its
  Dutch from the repo's own box UI, so this reduces a pre-existing English/Dutch mix
  rather than creating one — but it is a product change, not a visual one.
- ⚠️ **Not visually verified.** These screens sit behind auth, so nothing here was
  confirmed in a browser; `tsc`, tests and `next build` pass, which is not the same
  thing. The bundle's README also asks that the files not be screenshotted.
- Icons stay inline SVG rather than the design's Tabler CDN webfont: a third-party
  request from a signed-in page is exactly what `docs/data-handling-policy.md` treats
  as a deliberate decision, and an icon font does not earn one.

## Session log — 2026-09-13 (Bird Verify — managed OTP, no sender registration)
Branch `claude/bird-verify`. Migration `0021_bird_verify.sql` — **needs applying**.
Off unless `OTP_SENDER=bird-verify`; every other value leaves the existing flow alone.

- **Why:** live SMS sends kept failing after the account was funded. Bird's docs give
  three gates beyond funding — sender **claimed**, sender **registered per country**,
  and **destination enabled** (*"a fully approved registration still refuses messages
  while the destination is off"*). Verify sidesteps the sender gates: per Bird, its
  **shared senders** *"require no sender registration or template setup."*
- **Different API from `lib/bird.ts`.** Verified at
  bird.com/docs/guides/verify/sending-verifications — `POST /v1/verify/verifications`
  with `{to:{phone_number}}` or `{to:{email}}` → `{id:'vrf_…', status}`, and
  `POST /v1/verify/verifications/check` with `{to, code}` →
  `{success, reason, attempts_remaining}`. Statuses: pending → verified|failed|expired.
- **`lib/bird-verify.ts`** (new) — one `post()` for auth + error parsing, mirroring
  `lib/bird.ts`. Never logs the recipient or the code. A wrong code is a **200 with
  `success:false`**, not an error — conflating them would turn a mistyped digit into a
  500, and there's a test for it.
- **`lib/auth/verify-mode.ts`** — `birdVerifyMode(channel)`. ⚠️ **SMS only on purpose**:
  email stays on Resend, which already sends from our own verified domain, whereas
  Bird's shared sender would rebrand it. Falls back off when the key is missing rather
  than half-enabling.
- **Migration 0021** adds `otp_challenge.provider` ('local'|'bird_verify') +
  `provider_ref` (Bird's `vrf_…`), and makes `code_hash` nullable — guarded by a CHECK
  that a `local` challenge must still have one. The challenge row is still written in
  verify mode (without a hash) so **rate limiting, the attempt cap and the audit trail
  are unchanged**. The verify route dispatches on the row's `provider`, so flipping
  `OTP_SENDER` mid-flight can never check a Bird code against a local hash.
- ⚠️ **Trade-off to accept before switching:** on a shared sender the code arrives
  branded **Authifly**, not Content Box.
- ✅ **RESOLVED 2026-09-13 — root cause was an API-key SCOPE, nothing else.** With
  `OTP_SENDER=bird-verify` + `OTP_DEBUG_ERRORS=1`, a live probe returned the real
  reason at last: `Bird Verify start failed (403): E02035 This request requires the
  "verify:write" scope, which your credential has not been granted.` After granting
  `verify:write` on the Bird key, the same probe returned `{"ok":true,
  ttlSeconds:300, channel:"sms"}` (HTTP 200).
  **Every earlier hypothesis was wrong** — not account funding, not alphanumeric
  sender-ID registration, not `destination_enabled`, not a missing `Idempotency-Key`.
  A 403 on scope also proves the request shape was right the whole time. If plain SMS
  (`OTP_SENDER=bird`) is ever needed again, check its own scope (e.g. `sms:write`)
  FIRST — the original silent failure was most likely the same class of problem.
  **Lesson: get the provider's own error before theorising. Two rounds were lost to
  hypotheses that all sounded plausible and were all false.**
- Tests: `tests/bird-verify.test.ts` (13). **142 passing**; `tsc` clean; `next build`
  compiles.

## Session log — 2026-09-13 (optional password sign-in)
Branch `claude/password-login`. Migration `0020_password_login.sql` — **additive, needs
applying**. OTP is unchanged and remains the recovery path.

- **Why:** a returning user shouldn't wait for an SMS, and at ~$0.09 per Belgian SMS
  every repeat login is a real charge. Note the session cookie is already 30 days, so
  this mostly pays off on a new device or after clearing cookies — not every visit.
- **`lib/password.ts`** — scrypt from Node's stdlib (no bcrypt/argon2 dependency; same
  reasoning that kept the SMS/email transports on plain fetch). N=2^14, r=8, 16-byte
  salt, 64-byte key; stored as self-describing `scrypt$N$r$p$salt$hash` so the cost can
  be raised later **without invalidating existing passwords**. Constant-time compare;
  every malformed stored value returns false rather than throwing. Policy is
  length-led (min 10, max 200, must not be repetitive), not a character-class checklist.
- **`lib/fresh-auth.ts` + `lib/fresh-auth-cookie.ts`** (new) — a 15-minute proof that
  the account authenticated *from scratch*, minted on a successful OTP verify.
  ⚠️ **Deliberately NOT `lib/stepup.ts`.** That cookie is the admin fingerprint proof
  and `requireAdminStepUp()` gates the admin backend on it — minting it on an OTP
  sign-in would have let an operator into the admin area by SMS, skipping their
  fingerprint. Separate namespace (`freshauth:`), separate cookie, with tests asserting
  no token from one family verifies as another.
- **Setting a password requires fresh auth OR the current password** — never the
  30-day session alone, so a stolen cookie can't mint a permanent credential.
  Password *login* deliberately does NOT mint fresh-auth: a stored credential is not
  proof of live control of the number.
- **`lib/password-auth.ts`** — lockout after 8 failures for 15 min, reset on success.
  Uniform `invalid` for "no account" / "no password set" / "wrong password", **with
  dummy scrypt work on the missing-account path**, so the login form can't be used to
  discover which numbers are registered.
- Routes `POST|GET /api/auth/password/set`, `POST /api/auth/password/login`. UI:
  `/account/password` (set / change / remove) linked from `/app`; `/login` gained an
  "I have a password" mode that keeps the code path one click away.
- Tests: `tests/password.test.ts` (19) + `tests/fresh-auth.test.ts` (11). **129
  passing**; `tsc --noEmit` clean.
- **Known gap (not fixed here):** the lockout is per account. An attacker spraying one
  guess across many accounts is not slowed by it — that needs per-IP throttling with
  the other rate limits rather than bolted onto this route.

## Session log — 2026-09-13 (OTP failures made diagnosable)
Branch `claude/otp-debug-errors`. No migration.

- **Why:** two separate debugging rounds were lost to the same blind spot. A failed OTP
  send throws, the outer catch in `/api/auth/otp/start` logs the real cause but returns
  only *"Server not configured to send codes."*, and the Vercel runtime logs were not
  reachable in the moment. The provider's reason existed and was simply unreachable.
- **`OTP_DEBUG_ERRORS`** (new, `env.otpDebugErrors()`, OFF by default): when set, the
  500 response carries `detail` with the thrown message — `Bird send failed (400): …`,
  `Email send failed (403): validation_error …` — and `app/login/page.tsx` appends it
  to the on-screen error. Senders are written to keep the phone number, the address and
  the code out of their messages, so this exposes provider/config state only; it is
  still behind an explicit switch rather than on for everyone. Turn on, fix, turn off.
- **Fixed stale UI copy:** the SMS success message still said *"In this preview it is
  printed in the server console"* — untrue since Bird went live, and actively
  misleading during exactly this debugging. Now *"Code sent. Check your messages."*
- Tests: `tests/otp-debug.test.ts` (11). **110 passing**; `tsc --noEmit` clean.

### Bird status (2026-09-13) — still not sending
Account funded, but a live send still fails. Ruled out: not the rate limit (that is a
429 with different text) and not missing env vars (a real POST to Bird fires — three
external calls in the invocation trace). Leading hypothesis: **funding and sender
approval are separate gates.** bird.com/pricing/sms states *"Production unlocks once
you verify a sender"*, and alphanumeric sender IDs need per-country pre-registration in
several EU markets including Belgium. A Bird-owned E.164 number as `BIRD_FROM` sidesteps
that registration entirely and is the faster route to a first successful send.
⚠️ Unconfirmed — needs the `Bird send failed (NNN)` line (or `OTP_DEBUG_ERRORS=1`).

## Session log — 2026-09-12 (Resend wired up for email sign-in)
Branch `claude/resend-email-otp`. Config-only to switch on; **no migration**, no schema
change. Email sign-in shipped in #9 but had never been given credentials.

- **Why now:** the first live Bird SMS send failed (`/api/auth/otp/start` → 500) and the
  browser showed only the generic *"Server not configured to send codes."* — Bird's real
  reason was reachable only by digging through Vercel logs. Likely causes: an unfunded
  Bird balance (SMS is charged per send; Belgium **$0.090**/msg per bird.com/pricing/sms)
  and/or a still-unverified sender, since Bird's pricing page states *"Production unlocks
  once you verify a sender."* Email is the channel that costs nothing per attempt, so it
  was wired up as the parallel way in while Bird is sorted out.
- **`lib/email.ts` refactored onto a private `resendPost()`** — same shape as
  `lib/bird.ts`, so auth, error parsing and the never-log-the-recipient rule are written
  once. `sendEmail()` keeps its boolean fire-and-forget contract (payouts.ts,
  identity.ts unchanged); new **`sendEmailChecked()`** returns
  `{ok} | {ok:false,status,detail}` for callers that must not silently swallow a failure.
- **`lib/auth/otp-email.ts`** now throws `Email send failed (NNN): <name> <message>`
  instead of a bare `'Email OTP send failed'`. This is the whole point of the change: a
  403 `validation_error` (unverified `EMAIL_FROM` domain — the single most common setup
  failure) is otherwise indistinguishable from a bad key. Verified from Resend's docs,
  not memory: errors are `{statusCode, name, message}`; `onboarding@resend.dev` delivers
  **only to the Resend account owner's own address**.
- Guarded by tests that the code and the recipient never reach the log line or the
  thrown error — email is as private as a phone here.
- **`docs/resend-setup.md`** (new) — key, sender choice (smoke-test address vs. verified
  domain), free-tier caps (~3,000/mo, **100/day**), and a `name`-code → fix table.
  `.env.example` Resend block rewritten to say what unset actually does.
- Tests: `tests/email.test.ts` 3 → 11. **99 passing**; `tsc --noEmit` clean.
- **To go live (config, not code):** set `RESEND_API_KEY` + `EMAIL_FROM` in the Vercel
  `sx-content-box` project, redeploy. The Email tab on `/login` works from that deploy.

## Session log — 2026-09-11/12 (SMS provider → Bird)
Branch `claude/sms-bird` → PR #10, **merged to `main`** (squash `e6ff737`, 2026-09-12).
Pure config-selected addition; **no migration**, no behaviour change unless
`OTP_SENDER=bird`.

- **Why:** Twilio has been giving complications; the `OtpSender` adapter was built for
  exactly this swap. Bird's *current* API was **verified from bird.com docs, not memory**
  — it is the simple platform API, NOT the older "Channels API": `POST
  https://{eu1|us1}.platform.bird.com/v1/sms/messages`, `Authorization: Bearer
  bk_{region}_…`, flat body `{to, from, text, category}`, `202 Accepted`; error envelope
  `{type, code, message, request_id}`. So only 3 env vars: `BIRD_API_KEY`, `BIRD_REGION`
  (must match the key prefix), `BIRD_FROM` (alphanumeric sender ID or owned number).
- **`lib/bird.ts`** — ONE shared transport (`birdSendSms(to, text, category)`) used by
  both the OTP sender and notification SMS so they can't drift. Never logs phone/text;
  surfaces Bird's `code message` (top-level or nested `error`) in the failure detail.
- **`lib/auth/otp-bird.ts`** — `birdSender`, same contract as Twilio: unconfigured (or
  unknown region) → warn + stub fallback; rejected send → throws `Bird send failed
  (NNN): code message` → visible in `[otp/start] unexpected error:`. OTP uses
  `category:'authentication'`.
- **`lib/sms.ts`** — dispatches on `OTP_SENDER`: `bird` → Bird (`category:
  'transactional'`); **anything else → the original Twilio path, byte-for-byte
  unchanged** (regression-guarded by test). With `OTP_SENDER=bird`, Twilio vars are
  deliberately NOT a silent notification fallback.
- `lib/env.ts → env.bird()`, `lib/auth/sender.ts` `case 'bird'`, `.env.example` Bird
  section, `docs/bird-setup.md` (accuracy-flagged: HTTP-status table is reasoning, the
  log line's Bird code is authoritative), pointer atop `docs/twilio-setup.md`.
- **Template OTP (2026-09-12).** Bird can send a stored template instead of free text;
  verified at bird.com/docs/api/reference/create-sms-message: same endpoint/auth, body
  `{ to, template: { slug, language?, parameters } }`, **mutually exclusive with `text`**,
  and the template picks its own sender + category (so no from/category on that body).
  `lib/bird.ts` refactored onto a private `birdPost()` so both shapes share auth/error
  parsing; adds `birdSendTemplate()`. `otp-bird.ts` branches on the new optional
  `BIRD_TEMPLATE_SLUG` (+ `BIRD_TEMPLATE_LANGUAGE`): set → template with
  `parameters.code`; unset → free text, unchanged (regression-guarded by a test).
  ⚠️ We did NOT add `@messagebird/sdk`: the package is real and `BirdClient` is the
  right export, but its published README documents only `bird.email.send` — `sms.send`
  appears nowhere in it, so that method is unverified; the REST path is verified and
  keeps the serverless bundle small (same rationale as the Twilio sender).
- Tests: `tests/otp-bird.test.ts` (11) + `tests/sms-bird.test.ts` (4). `tsc` clean.
- **To go live (config, not code):** in Vercel set `OTP_SENDER=bird` + the 3 `BIRD_*`
  vars, redeploy. Keep `TWILIO_*` set for instant rollback (`OTP_SENDER=twilio`).
- **Live config (2026-09-12):** `OTP_SENDER=bird`, `BIRD_API_KEY`, `BIRD_REGION` and
  `BIRD_FROM` are set in the Vercel `sx-content-box` project (Production).
  `BIRD_TEMPLATE_SLUG` / `BIRD_TEMPLATE_LANGUAGE` deliberately left UNSET → the
  **free-text** path (the original, test-covered shape). `OTP_SENDER=bird` also closes
  the dev top-up route. Real delivery still depends on the `BIRD_FROM` sender ID being
  approved in Bird for BE/NL/DE/FR/LU — the first live send confirms it; an unapproved
  sender surfaces as a 400/422 in the `[otp/start]` log line, and an `[OTP:stub]` line
  while `OTP_SENDER=bird` means a `BIRD_*` var is missing or the region is wrong.

## Session log — 2026-09-11 (email sign-in, private)
Branch `claude/email-login-private` → PR #9. **Migration `0019_email_login.sql` APPLIED
live** to `jpnnzxnvubrosjjcbkmn` (version `20260911070703`) and verified: all five
`account` columns present with the right nullability, `account_has_login_identifier`
CHECK in place, `otp_challenge.channel` NOT NULL, 0 rows violating. Safe to merge —
the schema is ahead of the code, which is the correct order for an additive change.

- **Email as a second login channel, same privacy model as phone.** Mirrors the phone
  flow end-to-end. `lib/crypto.ts` refactored onto shared `encryptString/decryptString`
  (phone helpers are now thin wrappers, behaviour unchanged) + `encryptEmail/decryptEmail`,
  `emailHash` (domain-separated), `normalizeLoginEmail` (throws; the contact-email
  normaliser in lib/accounts returns null for empty — different on purpose).
  `lib/accounts.ts`: `findAccountByEmailHash`, `findOrCreateAccountByEmail`; the
  first-account operator bootstrap + audit/emit moved into a shared `afterCreate()` so
  both channels behave identically. The admin allowlist stays phone-based.
- **`lib/auth/channel.ts`** — `resolveLoginIdentifier(body)`: the one place deciding
  the channel; exactly one of `{phone,email}` or it throws. Both OTP routes use it.
  `otp_challenge` gained `channel` ('sms'|'email'); the challenge lookup on verify
  filters on channel too, so a phone code can't be redeemed against an email.
- **`lib/auth/otp-email.ts`** — Resend delivery. **Deliberately stricter fallback than
  SMS:** with no Resend configured, codes are stub-logged (address MASKED via
  `maskEmail`) ONLY when `OTP_SENDER=stub`; in any other mode email sign-in is
  refused with a 503 `EmailLoginUnavailable`. Reason: email is independent of
  `OTP_SENDER`, so a prod site running real SMS but no Resend would otherwise leak
  email codes into Vercel logs. The start route checks `emailLoginAvailable()` up
  front, before writing a challenge or spending rate-limit budget.
- **UI** `app/login/page.tsx`: Phone/Email segmented toggle; sends only the active
  identifier. Nullable phone verified safe: every `phone_enc` consumer already
  null-guards; `invitations.ts` phone-match fails *closed* for email-only accounts.
- Tests: `tests/email-login.test.ts` (13) — 76 total passing; `tsc --noEmit` clean.
- **Follow-ups (not in this PR, by design — reviewable chunks):** (1) email-bound box
  invitations (`acceptInvitation` still requires a phone match, so an email-only
  account can log in but can't yet join a box via invite); (2) link a second
  identifier to an existing account (avoid duplicate accounts); (3) encrypt the
  legacy plaintext `account.email` contact column to match this model.

## Session log — 2026-08-30 (login fix · payout security · Twilio docs)
Three PRs merged to `main`; two DB migrations applied live to `jpnnzxnvubrosjjcbkmn`.

- **Login "Unexpected end of JSON input" fixed (PR #2).** The login page did
  `await r.json()` unconditionally, so a bodyless 500 from an OTP route surfaced as that
  cryptic message. Root cause: the `otp_challenge` row inserts fine, then
  `getSender().send()` **throws** (Twilio rejects the send) → uncaught → empty 500.
  Fix: a `readJson()` helper in `app/login/page.tsx` (tolerates empty/non-JSON bodies),
  and a top-level try/catch in `app/api/auth/otp/{start,verify}/route.ts` that logs the
  real cause (`[otp/start] unexpected error: …`) and returns parseable JSON.
  ⚠️ Resilience only — real login still needs OTP delivery configured (see Outstanding).

- **Payout RPC security hardening (PR #3) — applied live.** The Supabase security advisor
  flagged `request_payout` / `decide_payout` as callable by `anon`/`authenticated`.
  Confirmed real: migration `0014` did `revoke … from anon, authenticated` but NOT from
  `PUBLIC`, so both roles still inherited EXECUTE and could hit `/rest/v1/rpc/decide_payout`
  with the public key (no internal authz — a money endpoint). Fixed in two layers:
  - `0017_lock_payout_execute.sql` — `revoke execute … from public, anon, authenticated`.
  - `0018_payout_internal_authz.sql` — internal guards: `request_payout` requires an ACTIVE
    account; `decide_payout` requires an ACTIVE `platform_operator` (both raise `P0004`
    before doing any work). Verified live; both advisor WARNs cleared.
  Lesson: locking a SECURITY DEFINER money function needs `revoke execute … from PUBLIC`,
  not just anon/authenticated (that's how `wallet_apply`/`rent_content` were done right).

- **Twilio setup documented (PR #4).** `docs/twilio-setup.md` — stub→Twilio switch,
  Standard API Key, Messaging Service + alphanumeric sender ID vs a bought number, EU
  geo-permissions, trial limits, env vars, and a Twilio error-code → fix table matching
  the new `[otp/start]` log line. Pointer added to Useful files.

### ⚠️ Outstanding (config, not code): OTP delivery on Vercel
Login won't complete for real users until OTP delivery is set in the `sx-content-box`
Vercel project (then redeploy — env changes don't touch existing deployments):
- **Unblock testing now:** `OTP_SENDER=stub` (or unset) — the code prints in the Vercel
  log as `[OTP:stub] … -> ######`. ⚠️ stub mode also OPENS `/api/wallet/topup` (free
  tokens for any signed-in user) — never leave a public production site in stub mode.
- **Real SMS:** `OTP_SENDER=twilio` + the `TWILIO_*` vars — see `docs/twilio-setup.md`.
- Live Supabase state (verified this session): migrations `0001`–`0018` all applied,
  `otp_challenge` writing normally — the DB is healthy; the blocker is Twilio config.

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
- `supabase/migrations/` — schema + RLS (`0001`–`0022` all applied live; `0020`'s four `account.password_*` columns verified present 2026-09-14)
- `lib/password.ts` / `lib/password-auth.ts` — scrypt hashing + lockout for optional password sign-in
- `lib/fresh-auth.ts` — 15-min proof of a from-scratch sign-in; NOT the admin step-up cookie
- `lib/supabase/{admin,server,client}.ts` — service-role / SSR / browser clients
- `lib/crypto.ts` — phone + login-email encrypt/decrypt, domain-separated HMACs, E.164 / email normalise
- `lib/auth/channel.ts` — `resolveLoginIdentifier`: phone-xor-email channel resolution for the OTP routes
- `lib/auth/otp-email.ts` — Resend OTP delivery with the strict (masked-stub / 503) fallback policy
- `lib/ids.ts` — public ID generation
- `lib/config.ts` — reads `app_config` (token defaults)
- `tests/` — vitest (unit +, later, integration/security)
- `lib/bird.ts` — shared Bird SMS transport (OTP + notifications); `lib/auth/otp-bird.ts` — Bird OTP sender
- `docs/bird-setup.md` — switch OTP delivery to Bird (preferred) + how to read a failed send
- `docs/resend-setup.md` — turn on email sign-in (Resend key + verified sender) + error-code fixes
- `lib/email.ts` — shared Resend transport: `sendEmail` (fire-and-forget) / `sendEmailChecked` (detailed)
- `docs/twilio-setup.md` — Twilio (fallback provider) setup + error-code fixes

## How to run
```bash
npm install
cp .env.example .env.local   # Supabase keys + generated crypto keys
npm run test
npm run dev
```
