# Verotel (Yoursafe) — getting content24market.space approved

Status 2026-09-27: **conditional yes from Verotel, nothing registered yet.** Source: email
from Mathilda, Verotel CES, ticket #11894813, replying to our 2026-09-14 request to add
this site as a second website. Quotes below are verbatim; everything else is our reading.

## What Verotel said (verbatim)

- The old account is gone: *"your merchant account with ID 9804000001383305 and website
  #136440 was canceled on August 10th. Please register for a new account with the new
  URL"*. That account belonged to secretxperience.eu — this site never had its own.
- Own shop ID and signature key for this site: *"Yes."*
- Rates: *"15.5% (+1.5% for rebills). Daily payouts with 8 day lag to a Yoursafe Business
  account in the name of your company."*
- Rolling reserve: *"10% for 26 weeks."*
- Creator revenue share: *"Outside the platform. We offer mass payouts with Yoursafe
  through upload of a CSV file or API"* — https://integrations.yoursafe.com/en/payment-services
- Documents: *"The list of required documents can be found on the Yoursafe business
  application form. This is sent to you once you register for a Yoursafe account through
  your merchant portal."*

## What the review needs from us (verbatim, then what it means here)

> *"send me premium test credentials to browse around with as a paid user (with sufficient
> tokens to make purchases with). You should have at least 10 complete demo profiles with
> content for sale. It should look like how it's intended to look so that we can
> experience it as an end user."*

| Requirement | Live today (DB snapshot 2026-09-27) | Gap |
|---|---|---|
| A reviewer account that can sign in without our phone | Sign-in is SMS OTP. Password sign-in exists (`/api/auth/password/login`, phone-or-email + password) but a password can only be set after a fresh OTP, and 1 account has one. | Create a dedicated reviewer account on a number we control, set its password once, hand over number + password. |
| "Sufficient tokens" on that account | 0 tokens in any wallet. No operator tool grants tokens; `/api/wallet/topup` opens only in stub mode (never on production). | Either a one-off `ledger_entry` of type `adjustment` via service role, or a small operator-only grant route in `/admin`. |
| ≥10 complete demo profiles | 6 active boxes, 3 content items (2 approved), all uploaded by one operator. The schema has **no creator profile** (no display name, bio or avatar) — a creator is a `CRT-…` id on a card. | Decide what a "profile" is here: 10 creator accounts, each with a box, a name and several items for sale. Probably needs a `creator_profile` (name, bio, avatar) and a creator page, or at least names on the feed cards. |
| Content for sale, looking as intended | Discover feed shows blurred previews; the master is behind a rental. Demo content itself does not exist. | Owner supplies images with rights to use them. Not something to invent. |
| Reviewer sees all demo content | `/api/discover` is membership-gated: a member sees only boxes they belong to. | Add the reviewer to every demo box (invite or direct membership). Do not make the reviewer an operator. |
| Card purchase actually works | `/api/wallet/purchase` returns `{configured:false}` without `VEROTEL_SHOP_ID` + `VEROTEL_SIGNATURE_KEY`; all 18 orders on record are NOWPayments, so Verotel is not configured on this project (inference). | After registration: set the NEW shop ID and key on the content-box Vercel project, FlexPay success/decline/postback URLs on content24market.space, then one real test purchase. |

## Order of work

1. **Register** a new Yoursafe/Verotel account for `https://content24market.space` under
   content creation / pics & clips (owner, in the merchant portal). Fill the Yoursafe
   business application form; documents are listed there. Entity: D&A+ bv,
   BE 0749.661.728. Payouts land in a Yoursafe Business account in the company name.
2. **Demo data** — owner decides the shape of a "profile" and provides content; then we
   seed 10 creators + boxes + items and the reviewer membership. Build the creator name
   layer first if the answer to "what is a profile" needs it.
3. **Reviewer credentials** — dedicated account, password set, tokens granted, member of
   every demo box. Send only via the ticket, never in the repo.
4. **Wire the new shop** — env vars, panel URLs, one real purchase, then reply to the
   ticket with the credentials.

## Economics to keep in mind

- 15.5% off the top plus a 10% reserve held 26 weeks: on €1,000 of sales we see €845 and
  €100 of that arrives ~six months later. The 8-day lag applies to every payout.
- Rebills (+1.5%) do not apply — tokens are one-off prepaid purchases, no subscriptions.
- Creator payouts stay ours to run (current flow: €50 threshold, operator approves in
  `/admin`). Yoursafe mass payouts (CSV/API) is the candidate rail for actually sending
  them; nothing is built for it yet.

## Side finding while checking the wallet (2026-09-27)

`token_order` holds **18 NOWPayments invoices, €425 in total, 2026-09-06 → 09-24, every
one still `pending`, and 0 tokens were ever credited.** Either every buyer abandoned the
crypto page, or the IPN never reached / never verified at `/api/wallet/crypto/webhook`.
Worth one look at the Vercel runtime logs for that path before assuming the crypto rail
works.

## Reply draft (to the ticket, from Dries)

Subject: Re: Request #11894813 — content24market.space

Dear Mathilda,

Thank you for the detailed answers, and no problem about the delay.

Understood on all points. We will register a new account for https://content24market.space
under content creation / pics & clips, complete the Yoursafe business application, and
prepare the review environment you describe: a paid test user with a token balance and
at least ten complete creator profiles with content for sale, presented exactly as end
users will see it. I will send the credentials through this ticket once that is ready.

Three short questions so we prepare the right thing:

1. Our sign-in is by SMS code. For your reviewer we would set up an account with a
   password instead, so nobody on your side needs to receive a text. Is that acceptable?
2. The tokens are one-off prepaid purchases (for example €10 = 1000 tokens), with no
   subscriptions. Am I right that the +1.5% rebill rate does not apply to us?
3. Is the 10% reserve released on a rolling basis after 26 weeks, per payout?

Kind regards,

Dries Smets
D&A+ bv · BE 0749.661.728
+32 477 70 47 40
support@secretxperience.eu
