---
name: Expired warranties
description: Warranties auto-expire on their end date; expired customers live in the Expired status filter and still feed Renewals when clean
type: feature
---

- `expire_overdue_policies()` (SECURITY DEFINER, service_role only) marks policies past `policy_end_date` as `expired` and sets `customers.status = 'Expired'` only when the customer has an expired policy and no remaining live policy. Never touches cancelled/refunded.
- Runs nightly via pg_cron job `expire-overdue-policies-daily` (00:10 UTC); backfilled 23 Oct 2026.
- `customers.status` check constraint allows Active / Cancelled / Expired only.
- Customer Management: "Expired" status filter; expired customers are hidden from the default list (like cancelled/refunded) and shown only via that filter or search.
- Renewals queue must include `expired` policies in the `recently_expired` and `all_renewals` segments — see `excludedStatusesFor()` in RenewalsQueueTab; other segments keep excluding them.
- Renewal eligibility is unchanged: claim history → Renewal approval hold; cancelled/refunded/open complaint/contact-restricted/unsubscribed → blocked.
