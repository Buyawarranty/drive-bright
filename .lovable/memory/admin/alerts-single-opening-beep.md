---
name: Alert pop-up sounds silenced after opening beep
description: All admin/sales pop-up alerts (new lead, open pool, missed call, reminders, handovers) play one two-tone beep per session then stay silent forever
type: constraint
---
Every alert sound entry point must call `consumeAlertSound()` from `src/lib/alertSoundBudget.ts` first. Budget is 1 two-tone beep per browser session (sessionStorage `alerts.sound_plays_used`), then permanently silent — no repeating beeps, no re-enabling. **Why:** sales staff found repeated beeping disruptive on calls. Never add a new pop-up sound without this guard.

**Exception (16 Oct 2026, user request):** the purple round robin new-lead corner pop-up plays exactly 5 beeps per newly arrived lead, then stops, with a Silence button that stops them immediately. It does not use the session budget.
