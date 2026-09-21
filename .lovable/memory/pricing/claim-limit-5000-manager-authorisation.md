---
name: £5,000 claim limit needs no authorisation (removed Sep 2026)
description: Agents can select and sell any claim limit including £5,000 on Quotes & Orders — the manager authorisation requirement was removed
type: constraint
---

Sep 2026: the £5,000 AutoCare Premium claim limit requires **no** manager authorisation. `claimLimit5kAllowed` in `GetQuoteTab.tsx` is hard `true`, so every agent can quote, send and take payment on any claim limit, and £5,000 is never forced back to £3,000.

Do not re-introduce the gate unless the user explicitly asks.

Kept for history only (never gates selection):
- `discount_auth_requests.request_type = 'claim_limit_5000'` rows and the management banner handling.
- `admin_config.claim_limit_5000_auth_required` and the Price updates toggle.
- `myApproved` (discount ceiling lift) still only matches `request_type = 'discount'`.
- The £5,000 tier stays hidden for the customer-journey blocklist makes (Tesla / Jaguar / Land Rover / Porsche) — that is a separate rule.
