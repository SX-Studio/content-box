# NOWPayments — crypto token purchases

Turns on the **crypto** rail for buying tokens. The code is already written and tested;
this is configuration only. Nothing here needs a migration — `token_order` is live.

Why crypto first: Stripe prohibits adult content, Verotel is still unapproved, and no
processor can decline a crypto payment. This is the fastest rail to a working checkout.

## What the code does

`POST /api/wallet/purchase-crypto` creates a pending `token_order` (`provider:
'nowpayments'`), then `POST https://api.nowpayments.io/v1/invoice` with the `x-api-key`
header and returns the hosted `invoice_url`. The buyer picks a coin on NOWPayments'
page. Later, NOWPayments calls `POST /api/wallet/crypto/webhook`; the wallet is credited
**only** on `payment_status: "finished"`, exactly once, keyed on the NOWPayments
payment id.

Verified against NOWPayments' own Node SDK, not from memory: the header is `x-api-key`,
the endpoint is `POST /v1/invoice`, the body fields are `price_amount` / `price_currency`
/ `order_id` / `order_description` / `ipn_callback_url` / `success_url` / `cancel_url`,
and the IPN signature is HMAC-SHA512 of `JSON.stringify(sortObjectDeep(payload))`
compared against the `x-nowpayments-sig` header.

## Setup — the order matters

1. **Add a payout wallet** in the NOWPayments Personal Account → *Payment Settings*.
   This is the address your EUR-priced sales are paid out to in crypto. **Do this
   first — the API key cannot be generated until a wallet exists.**
2. **Generate an API key** (Payment Settings → API keys).
3. **Generate the IPN secret** (Payment Settings). ⚠️ **It is shown in full only once.**
   Copy it immediately; if you lose it you must regenerate, which invalidates the old one.
4. In Vercel (project `sx-content-box`, Production) set:

   | Variable | Value |
   | --- | --- |
   | `NOWPAYMENTS_API_KEY` | the key from step 2 |
   | `NOWPAYMENTS_IPN_SECRET` | the secret from step 3 |
   | `APP_ORIGIN` | `https://content24market.space` — see the warning below |

5. **Redeploy.** Env changes do not touch existing deployments.

There is **no callback URL to register**: `ipn_callback_url` is sent with every invoice.

## ⚠️ APP_ORIGIN is a money-losing footgun

Every URL handed to NOWPayments — the IPN callback above all — is built from
`APP_ORIGIN`, which falls back to `http://localhost:3000` when unset. An invoice created
with that callback takes the buyer's crypto and then posts the "paid" notification into
the void: the money moves, the wallet is never credited, and nothing reports an error.

`createInvoice` therefore refuses to start checkout unless `APP_ORIGIN` is a public
`https` origin, and logs the reason. **Confirm it is set before taking a real payment.**

## Verifying it works

1. Sign in, go to `/wallet`, click a package. You should be redirected to a
   `nowpayments.io` hosted invoice rather than seeing *"er is nog geen betaalmethode
   ingesteld"*.
2. Pay the smallest package on-chain, or use NOWPayments' sandbox
   (`api-sandbox.nowpayments.io` with a sandbox key) to avoid spending real coin.
3. The wallet balance rises only after the IPN lands with `finished` — that is normal,
   and can take several confirmations. `/wallet`'s ledger shows the `purchase` entry.

## When it does not work

The route logs the provider's own words. Check the Vercel runtime log for
`[wallet/purchase-crypto]` and read the reason before theorising — this project has
already lost two debugging rounds to plausible, wrong hypotheses about a provider.

| Log line | Cause | Fix |
| --- | --- | --- |
| `APP_ORIGIN is not a public https origin` | `APP_ORIGIN` unset or localhost | Set it in Vercel, redeploy |
| `NOWPayments invoice failed (401/403)` | bad or revoked API key | Regenerate in Payment Settings |
| `NOWPayments invoice failed (400)` | rejected body — usually the amount is under the coin's minimum | Check `GET /v1/min-amount`; raise the package price |
| `NOWPayments returned no invoice_url` | account not fully set up | Confirm a payout wallet is saved |
| Buyer paid, balance unchanged | IPN never arrived or failed its signature | Confirm `APP_ORIGIN`; confirm `NOWPAYMENTS_IPN_SECRET` matches the current secret in the dashboard |

A wrong `NOWPAYMENTS_IPN_SECRET` is the quiet one: the webhook returns
`400 Invalid signature` and the buyer's wallet stays empty. Regenerating the secret in
the dashboard **without updating Vercel** causes exactly this.

## Not done here

- **Refunds/chargebacks**: crypto has none. A mistaken credit has to be corrected by an
  operator through the ledger.
- **`partially_paid`** is acknowledged but never credits. If buyers underpay in
  practice, decide a policy before changing that — crediting a partial payment is a
  money decision, not a code one.
