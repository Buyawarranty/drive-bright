---
name: Warranties 2000 API permanently off
description: Warranties Register / Warranties 2000 API is permanently disabled — never send them data in any format or re-add any function, cron job or test call
type: constraint
---

The Warranties 2000 (Warranties Register) API integration is switched off permanently.

Forbidden, with no exceptions:
- Creating or restoring any edge function that posts to Warranties 2000 (deleted: `process-scheduled-w2000`, `send-to-warranties-2000`, `warranties-2000-registration`).
- Any request to `https://warranties-epf.co.uk/api.php` or any other Warranties 2000 endpoint, including "test" or connectivity calls.
- Any cron job, trigger or queue that schedules a send.
- Re-enabling the switch in the admin API section (`WarrantiesRegisterKillSwitch.tsx` is locked off; `admin_config.warranties_2000_api_enabled` = false).

`customer_policies.warranties_2000_*` columns are historic record only — read, never write to trigger a send. Queued rows are set to `disabled_permanently`.

**Why:** the contract ended in June and every call to them costs money.
