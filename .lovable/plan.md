# Renewals feeding the New Leads section

Goal: every policy 60 days from expiry becomes a real lead in New Leads, owned by the agent who originally sold the warranty, and only falling to round robin when that agent is gone.

## How it works

1. **A daily job creates the renewal lead.** Once a day a scheduled function scans `customer_policies` for policies whose end date is exactly 60 days away and creates one `sales_leads` row per policy. It stamps the lead so it can never be created twice for the same policy and renewal year.

2. **Ownership: original seller first.** The lead owner is resolved in this order:
   - the agent credited with the original sale (sale credit, then payment confirmer, then quote sender, then the current customer owner),
   - if that agent is archived, deactivated, on leave, or not working new leads, the lead joins the normal round robin using the single existing rotation cursor and takes a normal turn (never ordered by how many leads someone already has today),
   - website-credited sales stay with the website rule and go to round robin.

3. **It looks and behaves like any other new lead.** Status `new`, never contacted, full vehicle and contact details copied over, priority set so it surfaces near the top, plus a "Renewal" tag and a system note saying which policy it came from and when it expires. It appears in New Leads, gets the standard new-lead pop-up alert for its owner, counts in the agent's figures, and follows the normal call/note/status workflow.

4. **Renewals tab becomes the control room, not a second list.** Each row in the Renewals queue shows who the lead went to and whether the lead exists yet, with:
   - a "Renewal lead" column showing owner + created date, or "not due yet",
   - a manual "Send to New Leads now" action for a policy that is further out (for example a customer who calls early),
   - a "Reassign" action that moves the renewal lead like any other lead, preserving notes and history,
   - the existing 60-day segment aligned so the tab and New Leads agree on the same window.

5. **No duplicates, no resurrection.** If the customer already has an open lead, the renewal is attached to that lead as a note instead of spawning a second one. Terminal statuses (lost, converted, fake lead, do not contact) never spawn a renewal lead. Cancelled or refunded policies are skipped.

## Technical notes

- New table `renewal_lead_links` (policy id, renewal year, lead id, resolved owner, reason for the owner choice) with grants, RLS and a unique key on policy + year: this is the idempotency guard and the audit trail.
- New edge function `create-renewal-leads`, run daily on cron, reusing the existing sale-credit resolver and the existing round-robin picker so live allocation logic is not duplicated.
- Reuse `sales_leads` only — no parallel lead table, so New Leads, alerts, scoreboard, notes and reminders all work with zero extra wiring.
- `RenewalsQueueTab.tsx` gains the ownership column and the two actions; the queue's own data source is unchanged.
- Backfill run once for policies already inside the 60-day window so nothing in flight is missed.

## Open choice

The 60-day trigger fires once per policy per renewal year. If you also want a second nudge closer to expiry (say 21 days) that re-raises the lead when it went cold, that can be added as a second milestone.
