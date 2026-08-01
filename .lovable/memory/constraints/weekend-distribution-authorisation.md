---
name: Weekend distribution changes need authorisation
description: Never alter Saturday Open Pool / Sunday solo weekend lead distribution logic without explicit user authorisation
type: constraint
---
Do NOT change weekend lead distribution behaviour (Saturday = all leads to Open Pool self-serve, Sunday = solo mode, stale >10min recycle to RR) unless the user explicitly authorises that specific change in the current request.

**Why:** Weekend rules are deliberate operational policy; unassigned weekend leads are expected behaviour, not a bug.

**How to apply:** If weekend behaviour looks like the cause of an issue, explain it and ask for authorisation before editing any weekend branch in the distribution RPCs/UI.
