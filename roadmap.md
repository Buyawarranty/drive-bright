# Roadmap

- [x] Discounts given: de-duplicate repeated manual price override rows (same agent/customer/price seconds apart)
- [x] Discounts given: agent filter must also filter the manual price overrides table
- [x] Discounts given: stop showing all-zero cards/bands/detail table on the 1st of a new month — land on the latest month that has sales and explain empty ranges
- [x] New Leads: date quick links + date selector must work for sales agents (moved links outside popover; picked date window now overrides the 60-day feed trim)
- [x] New Leads: fetch each sales/sales_lead agent's complete selected date range directly by owner, using the indexed created date and a date-preserving fallback so timeouts cannot reduce a month to the latest 500-row slice
