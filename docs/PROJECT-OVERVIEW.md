# SX-CONTENT24-BOX — Volledig projectoverzicht (A → Z)

> **Dit document is de belangrijkste naslag- en back-upgids van het hele project.**
> De volledige, actuele back-up is deze Git-repository zelf (code + migraties +
> ontwerpen + docs). Zie **§16 Back-up maken** om alles als één map op je computer
> te zetten.
>
> Laatst bijgewerkt: 2026-08. Status: kern-app + productie-hardening live
> (auth, boxen, content, wallet/rentals, moderatie, payouts, identiteitsverificatie,
> betalingen, admin-backend, juridische pagina's).

---

## 1. Wat is dit?

**Content Box** (project: **SX-CONTENT24-BOX**) is een **tijdelijke multi-creator
content-marktplaats**. Geen klassieke cloudopslag, geen klassiek abonnement.

**Kernlus — DROP → DISCOVER → RENT → EXPIRE:**
1. **DROP** — een creator plaatst content in een gedeelde **Box**.
2. **DISCOVER** — users zien één centrale feed met content van meerdere creators (blurred).
3. **RENT** — een user betaalt **tokens** om één item **24 uur** te huren.
4. **EXPIRE** — na 24 uur vervalt de toegang automatisch.

**Privacymodel:** pseudoniem tussen deelnemers, volledige controle voor het platform.
Deelnemers zien elkaars telefoonnummer nooit; alleen platform-operators kunnen (met
audit-logging) een nummer ontsleutelen. 18+ / adults-only; creators worden
identiteits-geverifieerd vóór publicatie.

---

## 2. Belangrijke coördinaten

| Onderdeel | Waarde |
|-----------|--------|
| **GitHub-repo** | `SX-Studio/content-box` (hernoemd; oude naam `Secret-xperience-Chat-Box` redirect) |
| **Supabase-project** | `jpnnzxnvubrosjjcbkmn` (`https://jpnnzxnvubrosjjcbkmn.supabase.co`) |
| **Vercel-project** | `sx-content-box` (team: sx-studio) |
| **Live URL (Vercel)** | `https://secret-xperience-chat-box.vercel.app` |
| **Eigen domein** | `content24market.space` (registrar: Hostinger) |
| **Deploy** | Auto-deploy bij elke push naar `main` |

**Domein:** Vercel DNS-methode — zet bij Hostinger de nameservers op
`ns1.vercel-dns.com` + `ns2.vercel-dns.com` (zie §13).

---

## 3. Technische stack

- **Frontend + backend:** Next.js 14 (App Router, TypeScript) — één app.
- **Database + opslag:** Supabase (Postgres + RLS, Storage, pg_cron, functies).
- **Hosting:** Vercel (auto-deploy op push; Vercel Cron voor de expiry-sweep).
- **Beeld/video:** `sharp` (thumbnail + blurred preview); video via directe upload-URL.
- **SMS/OTP:** provider-agnostische adapter — **stub** (log) of **Twilio** (echte SMS).
- **Betaling (tokens):** **Verotel FlexPay** (adult-vriendelijke PSP). Dev-top-up als
  fallback zolang Verotel niet geconfigureerd is. **Geen Stripe** (verbiedt adult).
- **Admin-beveiliging:** WebAuthn (passkey/vingerafdruk) step-up voor het admin-backend.
- **E-mail:** Resend (optioneel, o.a. payout-beslissingen).
- **Operator-assistent:** read-only, PII-vrije "Chat met Claude" (ANTHROPIC_API_KEY).
- **Tests:** Vitest.
- **Fonts:** Fraunces (display), IBM Plex Sans (body), IBM Plex Mono (data).

**Architectuurprincipe:** de logische "services" zijn **modules in één app**
(`lib/*`) met een `events`-tabel als event-backbone. Alle DB-toegang via server-routes
met de **service-role** client; RLS staat op elke tabel **deny-by-default** (tweede slot).

---

## 4. Projectstructuur (hoofdlijnen)

```
content-box/
├─ app/
│  ├─ page.tsx  layout.tsx  globals.css      # landing, layout+fonts, design-systeem
│  ├─ login/  app/  box/[id]/  rentals/  invite/[token]/  discover/
│  ├─ moderation/                            # moderation console
│  ├─ admin/  admin/unlock/                  # admin-backend (WebAuthn-vergrendeld)
│  ├─ legal/{terms,privacy,2257,dmca,refunds}/   # juridische pagina's
│  └─ api/                                   # alle server-endpoints (zie §8)
├─ lib/
│  ├─ supabase/{admin,server,client}.ts      # service-role / SSR / browser
│  ├─ env  crypto  ids  session(+cookie)  authz  accounts  ratelimit  config
│  ├─ auth/{otp,otp-adapter,otp-stub,otp-twilio,sender}  sms   # OTP + SMS
│  ├─ boxes  invitations  content  media  storage             # boxen + content
│  ├─ rentals  wallet  payouts  packages  verotel             # geld + huur + betaling
│  ├─ moderation  reports  identity                           # trust & safety
│  ├─ webauthn  stepup  admin-stepup  admin-assistant         # admin-backend
│  └─ audit  events  email                                    # logging + notificaties
├─ supabase/migrations/                       # 0001–0016 (zie §5)
├─ tests/                                      # Vitest
├─ docs/
│  ├─ PROJECT-OVERVIEW.md                      # dit bestand
│  └─ design/                                  # ontwerp-prototypes als HTML (§14)
├─ CLAUDE.md  README.md  .env.example
└─ package.json  tsconfig.json  next.config.mjs  vitest.config.ts
```

*(165+ bestanden; bovenstaande toont de mappen, niet elk bestand.)*

---

## 5. Databaseschema (migraties `0001`–`0016`)

Elke tabel: **RLS aan, deny-by-default**. Kritieke geldbewerkingen zijn
`SECURITY DEFINER`-functies die **alleen door service_role** uitvoerbaar zijn.

| Migratie | Inhoud |
|----------|--------|
| `0001` accounts_roles | `account` (versleuteld telefoon + HMAC), `account_role` |
| `0002` boxes_memberships | `box`, `box_membership` |
| `0003` invitations | `invitation` (token gehasht, eenmalig, tijdgebonden, telefoon-gebonden) |
| `0004` audit_events_config | `audit_log`, `events`, `app_config` (token-defaults) |
| `0005` rls_policies | RLS aan op alles + `current_account_id()` |
| `0006` otp_challenge | `otp_challenge` (gehashte code, pogingslimiet, expiry) |
| `0007` content | `content`, `content_asset` + buckets `master` (privé) / `preview` (publiek) |
| `0008` wallet_ledger | `wallet`, `ledger_entry` (onveranderlijk), `earning`, `wallet_apply()` |
| `0009` rentals | `rental` + `rent_content()` (atomische huur) |
| `0010` moderation | `moderation_case`, `report` |
| `0011` admin_webauthn | `admin_phone_allowlist`, `webauthn_credential` (passkey step-up) |
| `0012` admin_stats | read-only stats-views voor het admin-dashboard |
| `0013` cron_verotel | `expire_rentals()` (sweep) + `token_order` (Verotel-aankoop) |
| `0014` payouts | `payout` + request/decide RPC's (reserveert `earning`, €50-drempel) |
| `0015` account_email | optioneel `email` op `account` (voor notificaties) |
| `0016` identity_verification | `identity_verification` (ID+selfie in privé `identity`-bucket, 18+ gate) |

**Token-defaults (in `app_config`, operator-bewerkbaar):** `tokens_per_euro=100`,
`creator_split=0.80`, `payout_threshold_eur=50`, `rental_hours=24`,
`invitation_ttl_hours=72`.

**Storage buckets:** `master` (privé origineel), `preview` (publiek blurred/thumb),
`identity` (privé — ID-documenten, alleen service-role + korte signed URLs).

---

## 6. Rollen & rechten

- **platform_operator** — volledige controle; moderatie; kan GSM ontsleutelen (gelogd);
  admin-backend achter WebAuthn. Eerste account = operator; nummers op de
  `admin_phone_allowlist` worden altijd operator.
- **moderator** — moderatie-console, geen financiële controle.
- **box_admin** — beheert één box (creators uitnodigen, analytics); geen PII.
- **creator** — upload, prijs, eigen content, verkopen/earnings, payout-aanvraag.
- **user** — feed, tokens (kopen via Verotel of dev-top-up), huren, eigen library.

**Privacymatrix:** geen deelnemer ziet andermans telefoonnummer — alleen het platform,
met audit-logging. Identiteits-PII (ID/selfie) alleen zichtbaar voor geautoriseerde
reviewers via korte signed URLs.

---

## 7. Schermen (pagina's)

| Route | Voor wie | Doel |
|-------|----------|------|
| `/` | iedereen | landing + juridische links |
| `/login` | iedereen | telefoon + OTP |
| `/app` | ingelogd | dashboard: account, wallet, boxen, invites, payout |
| `/box/[id]` | box-leden | feed (blurred), upload, rent/view; eigen content = "View" |
| `/discover` | ingelogd | ontdek-feed over boxen heen |
| `/rentals` | ingelogd | "My Rentals" met live 24u-timers |
| `/moderation` | operator/moderator | queue, view-original, decisions, meldingen |
| `/admin` (+ `/admin/unlock`) | operator | admin-backend (WebAuthn step-up): stats, operators, payouts, verificaties, assistent, economics |
| `/legal/*` | iedereen | terms, privacy, 2257 (age records), dmca, refunds |
| `/invite/[token]` | uitgenodigd | verifiëren → box joinen |

---

## 8. API-endpoints (overzicht)

**Auth:** `/api/auth/otp/start` · `/api/auth/otp/verify` · `/api/auth/logout` · `/api/me`
**Account:** `/api/account/email`
**Boxen/invites:** `/api/boxes` · `/api/boxes/[id]` · `/api/boxes/[id]/invitations` ·
`/api/invitations/[token]/accept`
**Content/feed/discover:** `/api/content` · `/api/content/video-upload-url` ·
`/api/boxes/[id]/feed` · `/api/discover`
**Rentals:** `/api/content/[id]/rent` · `/api/content/[id]/view` · `/api/rentals/my`
**Wallet/betaling:** `/api/wallet` · `/api/wallet/topup` (dev) · `/api/wallet/purchase`
(Verotel) · `/api/verotel/webhook` · `/api/cron/expire`
**Payouts:** `/api/payouts/request` · `/api/payouts/me`
**Moderatie/meldingen:** `/api/moderation/{queue,[id]/decision,original/[id],reports,reports/[id]/resolve}` ·
`/api/reports`
**Verificatie:** `/api/verification`
**Admin (WebAuthn-gated):** `/api/admin/{search,operators,config,assistant}` ·
`/api/admin/payouts(+/decide)` · `/api/admin/verifications(+/decide)` ·
`/api/admin/webauthn/{register,authenticate}/{options,verify}`

---

## 9. Wat is gebouwd

- **Fase 1 — Identiteit & Boxen** ✅ — GSM/SMS-OTP, rollen, boxen, uitnodigingen, audit+events.
- **Fase 2 — Content & feed** ✅ — upload (foto + video), privé master + blurred preview, member-gated feed, discover.
- **Fase 3 — Wallet & rentals** ✅ — onveranderlijke token-ledger, atomische huur, 24u-timer, 80/20 split, **payouts** (€50, reserveer→betaal/afwijs), expiry-sweep (cron).
- **Fase 4 — Moderatie** ✅ — AI-screening (stub), console, meldingen, suspend blokkeert view.
- **Productie-hardening** ✅ — **Twilio** echte SMS, **Verotel** token-aankoop,
  **identiteits/leeftijdsverificatie**, **WebAuthn** admin step-up, **admin-backend**
  (stats, operators, config/economics, assistent), **juridische pagina's**,
  **e-mailnotificaties** (Resend).

---

## 10. Environment-variabelen

Volledig sjabloon staat in **`.env.example`**. Echte waarden staan in **Vercel →
Settings → Environment Variables** (en lokaal in `.env.local`, nooit committen).

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- **Crypto (32-byte hex):** `PHONE_ENCRYPTION_KEY`, `PHONE_HASH_KEY`, `SESSION_SECRET`
- **OTP/SMS:** `OTP_SENDER` (`stub`|`twilio`), `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`,
  en (bij twilio) `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`,
  `TWILIO_MESSAGING_SERVICE_SID` of `TWILIO_FROM_NUMBER`
- **WebAuthn:** `RP_ID`, `APP_ORIGIN` (prod: `content24market.space` /
  `https://content24market.space`)
- **Cron:** `CRON_SECRET` (Vercel Cron → `/api/cron/expire`)
- **Verotel:** `VEROTEL_SHOP_ID`, `VEROTEL_SIGNATURE_KEY`
- **Assistent:** `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (optioneel)
- **E-mail:** `RESEND_API_KEY`, `EMAIL_FROM`

> ⚠️ Bewaar de 3 crypto-sleutels veilig apart. Wijzigt `PHONE_HASH_KEY`, dan werken
> bestaande telefoon-lookups niet meer.

---

## 11. Lokaal draaien & deployen

```bash
npm install
cp .env.example .env.local        # vul sleutels in
npm run test
npm run dev                       # http://localhost:3000
```
Migraties: draai `supabase/migrations/0001..0016` in volgorde (Supabase SQL-editor of
CLI). **Deployen:** push naar `main` → Vercel bouwt + publiceert automatisch.

**Inloggen (stub-modus):** OTP-code staat in de Vercel-logs (`[OTP:stub] … -> code`).
Met `OTP_SENDER=twilio` + Twilio-vars komt de code als echte SMS. Eerste account =
operator; ook nummers op de admin-allowlist worden operator.

---

## 12. Beveiliging & compliance

- **Twee sloten:** applicatie-autorisatie + RLS deny-by-default op elke tabel.
- **Telefoon** AES-256-GCM versleuteld + HMAC voor lookup; nooit plaintext.
- **Geld** op onveranderlijke ledger; `wallet_apply`/`rent_content`/payout-RPC's zijn
  atomisch, idempotent, en alleen door service_role uitvoerbaar.
- **Admin-backend** achter WebAuthn (passkey/vingerafdruk) step-up.
- **Identiteits/leeftijdsverificatie** (18+): ID+selfie in privé-bucket, korte signed
  URLs, alleen voor reviewers.
- **Moderatie:** AI screent, mens beslist; suspend/reject blokkeert lopende views.
- **Juridisch:** Terms, Privacy, 18 U.S.C. **2257** (age records), **DMCA**, Refunds.
- **Betaling:** Verotel (adult-vriendelijk); **nooit Stripe** voor deze vertical.

---

## 13. Domein-setup (content24market.space)

Bij **Hostinger** de nameservers zetten op `ns1.vercel-dns.com` + `ns2.vercel-dns.com`
(Vercel DNS-methode). Daarna propagatie afwachten; Vercel valideert + geeft SSL.
Alternatief: nameservers behouden en het door Vercel getoonde **A-record**
(`76.76.21.21`) bij Hostinger toevoegen. **Kies één methode.** Geen codewijziging nodig.

Voor WebAuthn/betaling zet je in Vercel: `RP_ID=content24market.space`,
`APP_ORIGIN=https://content24market.space`, en de Verotel-postback op
`https://content24market.space/api/verotel/webhook`.

---

## 14. Ontwerp-artefacten (in `docs/design/`)

Dubbelklik om lokaal in een browser te openen:

| Bestand | Wat |
|---------|-----|
| `docs/design/content-box-architecture.html` | Systeemarchitectuur + ERD + beslissingen |
| `docs/design/content-box-prototype.html` | Klikbaar mobiel prototype (feed, rent, 24u, wallet) |
| `docs/design/content-box-admin.html` | Admin/Moderation-console layout |
| `docs/design/content-box-phase1.html` | Fase 1 bouwplan |

Online (claude.ai): architectuur `45c1283e…` · prototype `1b69c5da…` ·
admin `e26a6239…` · fase 1 `48f5b9a3…` (volledige URLs onder claude.ai/code/artifact/).

---

## 15. Nuttige documenten in de repo

- `CLAUDE.md` — project-geheugen (fase-status van de kern-build; kan achterlopen op de
  nieuwste productie-features — dít document is het actuele totaaloverzicht).
- `README.md` — korte start.
- `.env.example` — volledige env-sjabloon met uitleg per variabele.

---

## 16. Back-up maken (de hele map op je computer)

**Deze repository IS de volledige back-up** (code + migraties + ontwerpen + docs).

**A) ZIP downloaden (geen tools nodig):**
1. Ga naar `https://github.com/SX-Studio/content-box`
2. Groene knop **Code → Download ZIP** → uitpakken = volledige projectmap.

**B) Klonen met Git (blijft bijwerkbaar):**
```bash
git clone https://github.com/SX-Studio/content-box.git
```

**Bewaar apart, veilig (zit NIET in de repo):**
- Geheime env-waarden (service-role key, 3 crypto-sleutels, Twilio/Verotel/Resend/
  Anthropic keys) — staan in Vercel; bewaar een kopie in een wachtwoordmanager.
- Supabase database-inhoud — maak periodiek een export/back-up (Supabase dashboard →
  Database → Backups).
- Bewaar §2 (coördinaten) apart als snel-referentie.

---

## 17. Wat nog te doen (optioneel)

- Verdere design-polish (dashboard hero-saldo, feed-chips, rental-cart).
- Account restrict/suspend uitbreiden in de moderatie-console.
- Volledige libphonenumber-normalisatie i.p.v. de minimale E.164-parser.
- Verotel test → live compliance review afronden.
```
