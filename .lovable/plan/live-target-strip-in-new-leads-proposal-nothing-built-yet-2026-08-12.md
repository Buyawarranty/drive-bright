# Live target strip in New Leads — proposal (nothing built yet)

## What I found
The strip you screenshotted ("Monthly Revenue £18,450 / £30,000 · 9 days Working days left · £1,283 Required per working day · View target breakdown") does not exist in the current codebase — it is only on the published build. So this becomes one small new component rather than an edit of an existing one, and I will make it match the current data sources (`sales_targets` + month-scoped revenue, the same numbers the Scoreboard uses).

## My answers to your two questions

**1. "View target breakdown" — no, drop it.**
It only navigates the agent away from their leads to the Scoreboard, which most agents either can't see or shouldn't be editing. Everything useful (target, banked, gap, days left, daily number) already fits in the strip. Removing it keeps the agent in the leads list, which is where they should be. If a manager wants detail, they use the Scoreboard tab as today.

**2. "Working days" — agreed, remove it.**
Working days are rota-dependent and confusing (agents don't work 7 days, and pro-rata makes the number argue with itself). Replace with plain calendar days remaining in the month:

- `9 days` → **"Days left in August"** = calendar days from today to month end.
- `£1,283 Required per working day` → **"£X a day to hit target"** = gap ÷ days left (calendar).

Simple, unarguable, and identical for everyone.

## Proposed strip (agent view)
One line, read-only, no buttons:

```text
MY TARGET · AUGUST
£18,450 of £30,000        61%  [=========------]
£11,550 to go   ·   19 days left in August   ·   £608 a day to hit target
On track
```

- Status chip only: On track / Behind / Target hit. No editing, no agent picker, no manager controls.
- Shows the signed-in agent's own figures only — never anyone else's, and no team ranking.
- If no target is set: "No target set yet — ask your manager to set your monthly target."

## Visibility rules
- Sales / sales_lead: own strip only, read-only.
- Management (admin, super_admin, sales_manager): sees own strip too, plus keeps the existing team boards on the Scoreboard / Lead Allocation tabs — nothing about managing targets moves into New Leads.

## Technical notes
- New component `src/components/admin/leads/MyTargetStrip.tsx`, rendered near the top of `NewLeadsTab`, above the leads table.
- Data via the existing month-scoped scoreboard hooks (`useScoreboardData` / `useAgentScoresForMonth`) filtered to `currentAdminUserId`; revenue by `signup_date` within the calendar month, excluding cancelled/refunded, so it agrees with the Scoreboard.
- Days left = `differenceInCalendarDays(endOfMonth(now), now)`, floored at 0; per-day figure hidden on the last day of the month.
- No new tables, no writes — display only.

Say go and I'll build exactly this.
