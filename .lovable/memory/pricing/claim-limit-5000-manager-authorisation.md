---
name: £5,000 claim limit needs manager authorisation
description: Blanket rule — agents cannot sell the £5,000 AutoCare Premium claim limit on Quotes & Orders without manager approval per registration
type: feature
---

Blanket rule (Aug 2026): £5,000 per-claim cover on the Quotes & Orders page requires management authorisation on **every** vehicle, not just premium brands.

- Agents (non-management) see £5,000 locked. Tapping it opens a request dialog (reason + reg required) which inserts into `discount_auth_requests` with `request_type = 'claim_limit_5000'`.
- Management approve/decline from the existing top authorisation banner (`DiscountAuthBanner`).
- Approval is tied to the registration on the quote and lasts 24h (hook window).
- Without approval, `claimLimit === 5000` is forced back to £3,000 (`claimLimit 2000 + boostAddon`), so it can never be quoted, sent or paid.
- `myApproved` (discount ceiling lift) must only match `request_type = 'discount'` — a claim-limit approval must never lift the discount cap.
- The £5,000 tier stays hidden entirely for Tesla / Jaguar / Land Rover / Porsche on the customer journey.

**Why:** £3,000 → £5,000 only costs the customer +£8-£10/mo (~£96-£120 total) for £2,000 more exposure per claim with unlimited claims, so it was the easiest close and the mix jumped from ~15% to 43% of sales.
