---
name: Sale credit only ever a sales agent
description: Sale credit resolution skips every non-sales login, including manager overrides
type: constraint
---
A sale can only be credited to an `admin_users` row with role `sales` or `sales_lead`.

`buildSaleCreditResolver` walks `sale_credit_admin_user_id` → `payment_confirmed_by` → `quote_sent_by` → `assigned_to` and **skips any id that is not a sales agent** — including an explicit manager override. Back-office logins (`accounts@`, `support@`, `info@`, admins, managers, claims) confirm payments on an agent's behalf and must never appear on the scoreboard, analytics or agent revenue panels.

**Do NOT** restore the earlier rule that "an explicit override always wins whoever it points at" — that is how accounts@ ended up holding a sale.

If no sales agent is found in the chain, credit is Website / unassigned.
