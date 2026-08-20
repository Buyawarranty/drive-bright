---
name: A sale today clears the lead freeze
description: Any sale credited today immediately lifts an automatic lead pause and resets the "days without a sale" counter to 0
type: feature
---

An agent can never be shown as paused (or counted as having days without a sale) on a day
they have already sold.

- `evaluate_agent_lead_freeze` counts sales dated today; if > 0 the freeze verdict becomes
  "none" with reason "Sale made today — leads back on.", and any existing `auto` freeze row
  is unpaused straight away (not just when `frozen_until` expires).
- `ProgressOverviewStrip.tsx` short-circuits `lowSaleDays` to 0 when there is a sale today,
  so the strip reads "Receiving leads" / "No working days without a sale".
- Manager overrides still win for the day they cover.
