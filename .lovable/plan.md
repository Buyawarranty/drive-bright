# Worldpay Integration — Sandbox First

Two agent-facing payment flows on the admin Get Quote tab, replacing the current placeholder Worldpay block:

1. **Virtual Terminal (MOTO)** — agent keys the customer's card while on the phone.
2. **Pay by Link** — agent sends a hosted Worldpay payment URL by SMS/email; customer pays themselves.

Both start in Worldpay's **Try (sandbox)** environment. Live is a keys-only swap later.

---

## Product choice — Access Worldpay (REST)

We'll use the modern **Access Worldpay** REST API (not the legacy WPG XML gateway). It supports MOTO, hosted Payment Pages, and Payment Links from a single set of credentials.

Sandbox base: `https://try.access.worldpay.com`
Auth: HTTP Basic (username + password) + `entityRef` (merchant entity).

---

## PCI-DSS decision — MOTO uses tokenised fields

Agents will **not** post raw PAN through our servers. The MOTO screen will embed Worldpay's **Access Checkout** JS SDK, which renders card fields inside Worldpay-hosted iframes and returns a **session token**. Our edge function then calls `/api/payments/authorizations` with that token and `channel: "moto"`.

This keeps us in **SAQ A** scope instead of SAQ D. Non-negotiable — do not accept raw card data on our origin.

---

## Credentials to add (as secrets)

You'll need these from your Worldpay Access account (sandbox first):

- `WORLDPAY_USERNAME`
- `WORLDPAY_PASSWORD`
- `WORLDPAY_ENTITY_REF` (merchant entity reference)
- `WORLDPAY_CHECKOUT_ID` (public identifier for the Access Checkout JS SDK)
- `WORLDPAY_ENV` = `sandbox` | `live`
- `WORLDPAY_WEBHOOK_SECRET` (shared secret for verifying webhook signatures)

I'll open the secret form once the code that needs each one is in place.

---

## Data model

New table `worldpay_transactions` to record every authorisation attempt and link back to the sales lead / customer:

- id, created_at, updated_at
- sales_lead_id (nullable), customer_id (nullable), admin_user_id (agent)
- flow: `moto` | `link`
- environment: `sandbox` | `live`
- amount_pence, currency, description
- worldpay_payment_id, worldpay_link_id, worldpay_link_url
- status: `pending` | `authorised` | `captured` | `failed` | `cancelled` | `refunded`
- last_event, last_error, raw_response (jsonb)
- Admin-only RLS; agents insert/select their own via `has_role(auth.uid(),'admin' | 'super_admin' | 'sales_manager' | 'sales_lead' | 'sales')`.

---

## Edge functions

All under `supabase/functions/`, CORS + JWT-verified, Zod input validation:

- `worldpay-checkout-session` — mints a short-lived Access Checkout session config (returns `checkoutId` + amount metadata) so the MOTO UI can initialise the SDK.
- `worldpay-moto-authorize` — receives the tokenised session from the SDK, calls `POST /api/payments/authorizations` with `channel: "moto"`, records the result.
- `worldpay-create-payment-link` — calls Access Worldpay Payment Links API, stores the returned URL, returns it to the UI.
- `worldpay-send-payment-link` — takes the stored link and dispatches SMS (existing ClickSend integration) and/or email to the customer.
- `worldpay-webhook` — verifies signature, updates `worldpay_transactions.status`, marks the linked lead as paid, triggers downstream fulfilment (same path as Stripe success).

---

## UI changes

Replace the placeholder Worldpay block in `GetQuoteTab.tsx` with a single **Worldpay** card containing two tabs:

```text
┌─ Worldpay ────────────────────────────────────┐
│ [ Virtual Terminal ]  [ Pay by Link ]         │
│                                               │
│ Virtual Terminal tab:                         │
│   Amount £X.XX   Description ______           │
│   [Card number iframe]                        │
│   [Expiry] [CVV]                              │
│   Cardholder name ____                        │
│   [ Charge card £X.XX ]                       │
│                                               │
│ Pay by Link tab:                              │
│   Amount £X.XX   Expires in [24h ▾]           │
│   Send via: [x] SMS  [x] Email                │
│   [ Generate link ]                           │
│   → https://pay.worldpay.com/...   [Copy]     │
└───────────────────────────────────────────────┘
```

Both tabs show live status (pending → authorised) and log to the lead's activity feed.

---

## Rollout order

1. Migration for `worldpay_transactions` + grants + RLS.
2. Add the 6 secrets (sandbox values).
3. Deploy the 5 edge functions with sandbox base URL.
4. Build the UI (tabs + Access Checkout SDK loader) and wire it in place of the placeholder.
5. End-to-end sandbox test with Worldpay's test PANs; verify webhook updates the row and the lead.
6. Once you're happy, swap the 4 credential secrets to live values and flip `WORLDPAY_ENV=live`.

## Out of scope for this pass

- 3DS challenge UI polish (we'll accept Worldpay's default flow first).
- Refunds/void UI (data model supports it; UI comes later).
- Recurring / stored-card MOTO (needs Verified Tokens — separate task).
