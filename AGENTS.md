# Project architecture rules

- Store company-wide monthly Analytics revenue goals in `monthly_revenue_targets`; keep them separate from per-agent `sales_targets` because they measure different scopes.
- Multi-year Quotes & Orders offers only 12 monthly instalments or BAW PayLater; PayLater records and credits one yearly payment at collection because uncollected future years are not revenue.
- A manual Quotes & Orders total is the final BAW PayLater term total; split it across yearly collections without adding the standard 10% uplift again.
- Route renewal leads only to active agents with the Renewals workstream; prefer the original seller, otherwise use longest-waiting rotation so new starters never receive catch-up batches.
- Auto-create renewal leads only when there is no claim, cancellation, or refund history; claim/cancel/refund renewals wait in Renewal approval and enter New Leads only after a recorded management approval, because management decides whether to re-offer cover.
- Keep the sales phone availability rule separate from live-chat presence: phone calls are offered Mon–Fri 9am–6pm and Sat 12pm–4pm UK time, with callback/WhatsApp outside those hours.
- Keep Bumper date-of-birth collection as a dedicated checkout substep after Step 4 validation and before the external eligibility handoff, so payment pricing and provider logic remain shared with Step 4.