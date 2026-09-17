---
name: Google Ads sales upload must be redeployed after any change
description: Sales stop reaching Google Ads when upload-google-conversions runs stale deployed code; always redeploy it after edits and rely on its stall alert
type: feature
---
Sep 2026: Google Ads stopped receiving CRM sales because the live
`upload-google-conversions` edge function was running an older build than the
repo. The old build called `response.json()` on Google's reply and crashed with
`Unexpected token '<'` for every sale, so each hourly cron run marked all rows
`failed` and nothing was sent.

Rules:
- After ANY edit touching `upload-google-conversions` (or its shared helpers),
  redeploy that function in the same turn and invoke it once to confirm
  `uploaded > 0` or `total: 0`.
- Never parse a Google Ads response with `.json()` — read `text()` and try/catch,
  so a non-JSON reply is recorded instead of crashing the run.
- Pending rows are selected on `google_ads_conversion_uploaded_at IS NULL`, so a
  failed row retries every hour automatically. Do not "fix" a stall by clearing
  statuses; find the upload error.
- The function emails support@buyawarranty.co.uk once a day (09:00 UTC run) when
  a run sends nothing or 3+ sales have waited over 6 hours.
- `code 3 ... could not be attributed to a click` is normal for non-ad sales, not
  a fault.
