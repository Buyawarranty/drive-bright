---
name: PayBetter sales — one-year equivalent target credit
description: PayBetter sales only credit the one-year equivalent towards an agent's scoreboard target (total ÷ cover years)
type: feature
---
PayBetter is a selectable payment source (`paybetter`) in Confirm External Payment, Get a quote, part payments, payments pending and the Customers payment filter.

Target credit rule: PayBetter sales cancel easily, so they count towards the monthly scoreboard target at the ONE YEAR EQUIVALENT only — `final_amount / cover years`. A 2-year or 3-year PayBetter warranty is credited as the yearly figure. All other payment sources count in full.

Implemented in `get_team_scoreboard` (SQL) and `src/lib/payBetterSales.ts` (`isPayBetterSale`, `targetCreditAmount`, `PAYBETTER_TARGET_NOTE`). Reported revenue in analytics and on customer records is unchanged.

PayBetter sales are tagged in customer management (violet "PayBetter sale" badge + Manage Customer dialog tag) and highlighted in Confirm External Payment and the team target board.
