# Roadmap

- [x] Discounts given: de-duplicate repeated manual price override rows (same agent/customer/price seconds apart)
- [x] Discounts given: agent filter must also filter the manual price overrides table
- [x] Discounts given: stop showing all-zero cards/bands/detail table on the 1st of a new month — land on the latest month that has sales and explain empty ranges
- [x] New Leads: date quick links + date selector must work for sales agents (moved links outside popover; picked date window now overrides the 60-day feed trim)
- [x] New Leads: fetch each sales/sales_lead agent's complete selected date range directly by owner, using the indexed created date and a date-preserving fallback so timeouts cannot reduce a month to the latest 500-row slice
- [x] New lead pop-ups: agents missed their own brand-new leads because rows with a NULL assigned_at fell outside the 50-row window ordered by assigned_at — now read both orderings and merge
- [x] GCLID: store the Google Click ID on each lead (sales_leads.gclid), auto-filled from the visitor's basket/customer record, backfilled for existing leads, and shown in the lead source tooltip
- [x] CRM reliability: fix the shared request starvation behind missing new-lead pop-ups and slow/non-loading tabs for James, Freddie and Thomas; alert reads now use the urgent lane, retain the last queue on transient failure, retry during heavy-tab loads, and scope dismissals per agent
- [x] Website chat "speak to a human": during opening hours the request must always ring every manager/staff member in the CRM (handover alert popup mounted in the dashboard), never answer with a reopen time
- [x] CRM: live-chat banner at the top of the whole dashboard during opening hours (9am-6pm Mon-Sat), visible to claims staff too
