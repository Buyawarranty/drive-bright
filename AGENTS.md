# Project architecture rules

- Store company-wide monthly Analytics revenue goals in `monthly_revenue_targets`; keep them separate from per-agent `sales_targets` because they measure different scopes.
- Multi-year Quotes & Orders offers only 12 monthly instalments or BAW PayLater; PayLater records and credits one yearly payment at collection because uncollected future years are not revenue.
- Route renewal leads only to active agents with the Renewals workstream; prefer the original seller, otherwise use longest-waiting rotation so new starters never receive catch-up batches.
- Auto-create renewal leads only when there is no claim, cancellation, or refund history; claim/cancel/refund renewals wait in Renewal approval and enter New Leads only after a recorded management approval, because management decides whether to re-offer cover.