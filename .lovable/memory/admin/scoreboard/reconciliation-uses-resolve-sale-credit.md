---
name: Scoreboard reconciliation uses resolve_sale_credit
description: Any panel reconciling scoreboard revenue against Customer Management must credit sales via resolve_sale_credit, not a raw COALESCE chain
type: feature
---
`get_scoreboard_reconciliation` and `get_team_scoreboard` must both credit a sale with `public.resolve_sale_credit(sale_credit, payment_confirmed_by, quote_sent_by, assigned_to)`, which skips non-sales accounts so back-office confirmations (accounts@, support@, info@, admins) fall through to the sales agent who worked the deal.

A raw `COALESCE(...)` chain in the reconciliation invented a large "credited to management / support" bucket (£19,976 in Aug 2026) while the agent cards showed the same money on James/Freddie/Thomas — the two views disagreed and totals double-counted. Both RPCs also include approved `commission_claims` and count on `signup_date`, excluding cancelled/refunded.

The `management` bucket now only ever holds explicit manager overrides of `sale_credit_admin_user_id` to a non-sales account.
