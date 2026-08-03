---
name: ORR pop-ups are not authorised
description: The Open Round Robin / Open Lead Pool pop-up is hard-disabled by kill switch; never re-enable or reword it without explicit owner authorisation
type: constraint
---
`ORR_POPUP_AUTHORISED = false` in `src/components/admin/leads/OpenPoolLeadAlert.tsx` hard-disables the Open Round Robin pop-up for **everyone** — no role, manager, or test account sees it.

Rules:
- Never flip it to `true`, and never add another ORR/lead pool pop-up, without an explicit instruction from the business owner.
- Pop-up wording must be signed off by the owner before it ships. Do not invent or "improve" ORR copy.
- Role/global-switch gating (sales roles only + `shark_tank_settings.enabled`) stays in `useAgentOpenPoolMode` as a second line of defence.

**Why:** unauthorised pop-ups with unapproved wording reached a claims agent while ORR was switched off.
