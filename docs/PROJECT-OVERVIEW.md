# SX-CONTENT24-BOX — Volledig projectoverzicht (A → Z)

> **Dit document is de belangrijkste naslag- en back-upgids van het hele project.**
> De volledige, actuele back-up is deze Git-repository zelf (code + migraties +
> ontwerpen + docs). Zie **§15 Back-up maken** onderaan om alles als één map op je
> computer te zetten.
>
> Laatst bijgewerkt: 2026-08 · Status: Fases 1–4 live in productie.

---

## 1. Wat is dit?

**Content Box** (werknaam project: **SX-CONTENT24-BOX**) is een **tijdelijke
multi-creator content-marktplaats**. Geen klassieke cloudopslag, geen klassiek
abonnement.

**De kernlus — DROP → DISCOVER → RENT → EXPIRE:**
1. **DROP** — een creator plaatst content in een gedeelde **Box**.
2. **DISCOVER** — users zien één centrale feed met content van meerdere creators
   (blurred previews).
3. **RENT** — een user betaalt **tokens** om één item **24 uur** te huren.
4. **EXPIRE** — na 24 uur vervalt de toegang automatisch.

**Privacymodel:** pseudoniem tussen deelnemers, volledige controle voor het platform.
Deelnemers zien elkaars telefoonnummer nooit; alleen platform-operators kunnen (met
audit-logging) een nummer ontsleutelen.

Zelfstandig product; een optionele koppeling met Secret Xperience kan later.

---

## 2. Belangrijke coördinaten

| Onderdeel | Waarde |
|-----------|--------|
| **GitHub-repo** | `SX-Studio/Secret-xperience-Chat-Box` |
| **Supabase-project** | `jpnnzxnvubrosjjcbkmn` (`https://jpnnzxnvubrosjjcbkmn.supabase.co`) |
| **Vercel-project** | `sx-content-box` (team: sx-studio) |
| **Live URL (Vercel)** | `https://secret-xperience-chat-box.vercel.app` |
| **Eigen domein** | `content24market.space` (registrar: Hostinger) |
| **Deploy** | Auto-deploy bij elke push naar `main` |

**Domein-status:** zet de nameservers bij Hostinger op `ns1.vercel-dns.com` en
`ns2.vercel-dns.com` (Vercel DNS-methode). Zie §12.

---

## 3. Technische stack

- **Frontend + backend:** Next.js 14 (App Router, TypeScript) — één app.
- **Database + opslag:** Supabase (Postgres + Row-Level Security, Storage, functies).
- **Hosting:** Vercel (auto-deploy op push).
- **Beeldverwerking:** `sharp` (thumbnail + blurred preview).
- **Tests:** Vitest.
- **Fonts:** Fraunces (display), IBM Plex Sans (body), IBM Plex Mono (data).
- **SMS/OTP:** provider-agnostische adapter (nu een **stub** die codes naar de
  serverlog schrijft; echte provider zoals Twilio/MessageBird plugt later in).
- **Betaling:** ⚠️ **NIET Stripe** (verbiedt adult content). Token-aankoop wacht op
  een adult-vriendelijke PSP + juridische token-analyse. Nu een **dev top-up**.

**Architectuurprincipe:** de 11 logische "services" (auth, box, content, rental,
wallet, moderatie, …) zijn **modules in één app** met een `events`-tabel als
event-backbone (staat in voor Kafka). Pas echte microservices bij bewezen schaal.

---

## 4. Projectstructuur

```
secret-xperience-chat-box/
├─ app/
│  ├─ layout.tsx                 # root layout + fonts
│  ├─ globals.css                # design-systeem (ember/velvet, licht+donker)
│  ├─ page.tsx                   # landingspagina
│  ├─ login/page.tsx             # telefoon → OTP verificatie
│  ├─ app/page.tsx               # dashboard: account, wallet, boxen, invites
│  ├─ box/[id]/page.tsx          # box-feed: upload + blurred feed + rent/view
│  ├─ rentals/page.tsx           # "My Rentals" met 24u-countdown
│  ├─ moderation/page.tsx        # moderation console (operator/moderator)
│  ├─ invite/[token]/page.tsx    # uitnodiging accepteren
│  └─ api/                       # alle server-endpoints (zie §8)
├─ lib/
│  ├─ supabase/{admin,server,client}.ts  # service-role / SSR / browser clients
│  ├─ env.ts                     # gevalideerde env-variabelen
│  ├─ crypto.ts                  # telefoon versleutelen + HMAC + E.164
│  ├─ ids.ts                     # publieke IDs (USR-/CRT-/BOX-/CNT-/INV-/RPT-)
│  ├─ session.ts / session-cookie.ts   # getekende sessie-cookie
│  ├─ authz.ts                   # currentAccount / rollen / hasRole
│  ├─ accounts.ts                # account zoeken/aanmaken (1e = operator)
│  ├─ auth/{otp,otp-adapter,otp-stub,sender}.ts  # OTP + SMS-adapter
│  ├─ boxes.ts                   # box aanmaken/lijst
│  ├─ invitations.ts             # uitnodiging aanmaken/accepteren
│  ├─ content.ts / media.ts / storage.ts  # upload-validatie, sharp, opslag
│  ├─ rentals.ts                 # rent, view (signed URL), my rentals
│  ├─ wallet.ts                  # saldo, ledger, wallet_apply
│  ├─ moderation.ts / reports.ts # moderatie + meldingen
│  ├─ audit.ts / events.ts       # audit-log + event-backbone
│  ├─ ratelimit.ts / config.ts   # OTP rate-limit + app_config
├─ supabase/migrations/          # 0001–0010 (volledig schema, zie §5)
├─ tests/                        # Vitest (28 tests)
├─ docs/
│  ├─ PROJECT-OVERVIEW.md        # dit bestand
│  └─ design/                    # de ontwerp-prototypes als HTML (zie §13)
├─ CLAUDE.md                     # project-geheugen (fase-status, beslissingen)
├─ README.md
├─ .env.example                  # sjabloon van env-variabelen (§10)
├─ package.json / tsconfig.json / next.config.mjs / vitest.config.ts
```

---

## 5. Databaseschema (migraties `0001`–`0010`)

Alle tabellen hebben **RLS aan met deny-by-default**: de browsersleutel kan niets;
alle toegang loopt via server-routes met de **service-role**-sleutel.

| Migratie | Tabellen / functies |
|----------|---------------------|
| `0001_accounts_roles` | `account` (versleuteld telefoon + HMAC), `account_role` (scoped rollen) |
| `0002_boxes_memberships` | `box`, `box_membership` |
| `0003_invitations` | `invitation` (token gehasht, eenmalig, tijdgebonden, telefoon-gebonden) |
| `0004_audit_events_config` | `audit_log`, `events`, `app_config` (token-defaults) |
| `0005_rls_policies` | RLS aan op alles + `current_account_id()` helper |
| `0006_otp_challenge` | `otp_challenge` (gehashte code, pogingslimiet, expiry) |
| `0007_content` | `content`, `content_asset` + storage buckets `master` (privé) / `preview` (publiek) |
| `0008_wallet_ledger` | `wallet`, `ledger_entry` (onveranderlijk), `earning`, `wallet_apply()` |
| `0009_rentals` | `rental` + `rent_content()` (atomische huur-transactie) |
| `0010_moderation` | `moderation_case`, `report` |

**Kritieke functies (SECURITY DEFINER, alleen door service_role uitvoerbaar):**
- `wallet_apply(...)` — atomisch, rij-vergrendeld, idempotent, weigert negatief saldo.
- `rent_content(...)` — debiteert user + boekt creator-split + maakt rental met
  `expires_at = now() + rental_hours`, alles in één transactie.

**Token-defaults (in `app_config`, wijzigbaar zonder code):** `tokens_per_euro=100`
(100 tokens = €1), `creator_split=0.80` (80/20), `payout_threshold_eur=50`,
`rental_hours=24`, `invitation_ttl_hours=72`.

---

## 6. Rollen & rechten

- **platform_operator** — volledige controle; moderatie; kan GSM ontsleutelen (gelogd).
  Het **eerste account dat inlogt** wordt automatisch operator.
- **moderator** — moderatie-console, geen financiële controle.
- **box_admin** — beheert één box (creators uitnodigen, analytics); geen PII.
- **creator** — upload, prijs, eigen content bekijken, verkopen/earnings.
- **user** — feed bekijken, tokens, huren, eigen library.

Privacymatrix: **geen enkele deelnemer ziet andermans telefoonnummer.** Alleen het
platform, met audit-logging.

---

## 7. Schermen (pagina's)

| Route | Voor wie | Doel |
|-------|----------|------|
| `/` | iedereen | landing → inloggen |
| `/login` | iedereen | telefoon + OTP |
| `/app` | ingelogd | dashboard: account, **wallet + top-up**, boxen, invites |
| `/box/[id]` | box-leden | feed (blurred), upload (creators), rent/view |
| `/rentals` | ingelogd | "My Rentals" met live 24u-timers |
| `/moderation` | operator/moderator | queue, view-original, approve/suspend/reject, meldingen |
| `/invite/[token]` | uitgenodigd | verifiëren → box joinen |

---

## 8. API-endpoints

**Auth:** `POST /api/auth/otp/start` · `POST /api/auth/otp/verify` ·
`POST /api/auth/logout` · `GET /api/me`
**Boxen:** `POST /api/boxes` · `GET /api/boxes/[id]` ·
`POST /api/boxes/[id]/invitations` · `POST /api/invitations/[token]/accept`
**Content & feed:** `POST /api/content` (upload+screen) ·
`GET /api/boxes/[id]/feed`
**Rentals:** `POST /api/content/[id]/rent` · `GET /api/content/[id]/view`
(signed URL) · `GET /api/rentals/my`
**Wallet:** `GET /api/wallet` · `POST /api/wallet/topup` (dev)
**Moderatie:** `GET /api/moderation/queue` · `POST /api/moderation/[id]/decision` ·
`GET /api/moderation/original/[id]` · `GET /api/moderation/reports` ·
`POST /api/moderation/reports/[id]/resolve` · `POST /api/reports`

**Regel:** autorisatie wordt per verzoek server-side herbepaald; elke gevoelige actie
schrijft een audit-regel.

---

## 9. De vier fases (wat is gebouwd)

- **Fase 1 — Identiteit & Box-fundament** ✅ live
  GSM/SMS-OTP, rollen, boxen, uitnodigingen, audit + events.
- **Fase 2 — Content & blurred feed** ✅ live
  Upload → privé master + blurred preview (sharp), member-gated feed.
- **Fase 3 — Wallet & rentals** ✅ kern live
  Onveranderlijke token-ledger, atomische huur, 24u-timer, 80/20 split.
  *Resterend:* creator earnings-dashboard, €50 payouts, pg_cron expiry-sweep.
- **Fase 4 — Moderatie** ✅ live
  AI-screening (stub) op upload, console, meldingen, suspend blokkeert view.

10 migraties, 28 tests, Supabase security-advisor schoon (alleen bedoelde
deny-by-default meldingen).

---

## 10. Environment-variabelen

Zie `.env.example` voor het sjabloon. De **echte waarden** staan in **Vercel →
Settings → Environment Variables** (en lokaal in een `.env.local`, nooit committen):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (geheim, alleen server)
- `PHONE_ENCRYPTION_KEY`, `PHONE_HASH_KEY`, `SESSION_SECRET` (elk 32 bytes hex)
- `OTP_SENDER=stub`, `OTP_TTL_SECONDS=300`

> ⚠️ **Bewaar de 3 crypto-sleutels veilig apart.** Als `PHONE_HASH_KEY` wijzigt,
> werken bestaande telefoon-lookups niet meer.

---

## 11. Lokaal draaien & deployen

```bash
npm install
cp .env.example .env.local        # vul Supabase-sleutels + crypto-sleutels in
npm run test                      # 28 tests
npm run dev                       # http://localhost:3000
```
Migraties toepassen: draai de bestanden in `supabase/migrations/` in de Supabase
SQL-editor (in volgorde 0001→0010), of via de Supabase CLI/MCP.

**Deployen:** push naar `main` → Vercel bouwt en publiceert automatisch.

**Inloggen in stub-modus:** de OTP-code wordt naar de Vercel-logs geschreven
(`[OTP:stub] +32… -> code`). Lees hem daar. Het eerste account wordt operator.

---

## 12. Domein-setup (content24market.space)

Gekozen methode: **Vercel DNS (nameservers)**. Bij **Hostinger** de nameservers
zetten op:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

Daarna wacht je op propagatie; Vercel valideert en geeft automatisch SSL. Alternatief
(nameservers behouden): gebruik in Vercel het tabblad **DNS Records** en voeg de
getoonde **A-record** (`76.76.21.21`) toe bij Hostinger. **Kies één methode.**

Geen codewijziging nodig — de app werkt op elk domein.

---

## 13. Ontwerp-artefacten (in `docs/design/`)

Open deze HTML-bestanden lokaal in een browser (dubbelklik):

| Bestand | Wat |
|---------|-----|
| `docs/design/content-box-architecture.html` | Volledige systeemarchitectuur + ERD + beslissingen |
| `docs/design/content-box-prototype.html` | Klikbaar mobiel prototype (feed, rent, 24u-timer, wallet) |
| `docs/design/content-box-admin.html` | Admin/Moderation-console layout |
| `docs/design/content-box-phase1.html` | Fase 1 bouwplan (bestanden/tabellen/endpoints) |

Online versies (claude.ai artifacts):
- Architectuur: https://claude.ai/code/artifact/45c1283e-50a5-48e9-aa82-1a4cdf505ef7
- Prototype: https://claude.ai/code/artifact/1b69c5da-0515-40b6-b5d2-6b45739cf8ee
- Admin console: https://claude.ai/code/artifact/e26a6239-5a7b-471c-a7fa-d5dcf9af382e
- Fase 1-plan: https://claude.ai/code/artifact/48f5b9a3-65be-4fb0-9ea6-ba305fae2ed4

---

## 14. Beveiliging & compliance (kort)

- **Twee sloten:** applicatie-autorisatie + RLS deny-by-default op elke tabel.
- **Telefoon** versleuteld (AES-256-GCM) + HMAC voor lookup; nooit plaintext.
- **Uitnodiging-tokens** gehasht, eenmalig, tijdgebonden, telefoon-gebonden.
- **Geld** op een **onveranderlijke ledger** met idempotente, atomische mutaties.
- **wallet_apply / rent_content** zijn SECURITY DEFINER en **alleen door service_role
  uitvoerbaar** (advisor-lek gedicht).
- **Moderatie:** AI screent, mens beslist; suspend/reject blokkeert ook lopende views.
- **Geen Stripe** voor deze vertical (adult) — aparte PSP + juridische analyse nodig.

---

## 15. Back-up maken (de hele map op je computer)

**Deze repository IS de volledige back-up** (code + migraties + ontwerpen + docs).
Twee manieren om alles als map op je computer te krijgen:

**A) ZIP downloaden (geen tools nodig):**
1. Ga naar `https://github.com/SX-Studio/Secret-xperience-Chat-Box`
2. Groene knop **Code → Download ZIP**
3. Pak uit → je hebt de volledige projectmap lokaal.

**B) Klonen met Git (blijft bijwerkbaar):**
```bash
git clone https://github.com/SX-Studio/Secret-xperience-Chat-Box.git
```

**Wat NIET in de repo zit (bewaar apart, veilig):**
- De **geheime env-waarden** (service-role key, 3 crypto-sleutels) — staan in Vercel.
- De **Supabase-database-inhoud** zelf — maak periodiek een Supabase-back-up/export
  (Supabase dashboard → Database → Backups).

> Tip: bewaar naast de code-ZIP een klein tekstbestand met de coördinaten uit §2 en
> een veilige kopie van de env-sleutels (bv. in een wachtwoordmanager).

---

## 16. Wat nog te doen (optioneel)

- Fase 3-restant: creator **earnings-dashboard**, **payout-aanvragen** (€50),
  **pg_cron expiry-sweep**.
- **Echte SMS-provider** inpluggen (Twilio/MessageBird) i.p.v. de stub.
- **Adult-vriendelijke PSP** + juridische token-analyse voor echte token-aankoop.
- Verdere **design-polish** (dashboard hero-saldo, feed-chips, rental-cart).
- Account **restrict/suspend** in de moderatie-console.

---

*Voor de actuele fase-status en projectbeslissingen: zie `CLAUDE.md` in de hoofdmap.*
