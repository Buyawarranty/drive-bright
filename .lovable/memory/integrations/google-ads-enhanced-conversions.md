---
name: Google Ads enhanced conversions fallback
description: Sales without a gclid still upload to Google Ads using hashed email/phone/name+postcode
type: feature
---
`upload-google-conversions` uploads EVERY unuploaded active sale in the 60-day window, not just rows with a `gclid`.

- With a click id: normal click conversion, status `uploaded`.
- Without a click id: enhanced conversion using `userIdentifiers` only (hashed email, hashed phone E.164, and `addressInfo` with hashed first/last name + GB postcode). Status `uploaded_enhanced`.
- `orderId` = `warranty_number` (else `source:id`) so re-uploads de-duplicate in Google.
- No click id and no email/phone → status `skipped: no click id and no email/phone to match on`.
- Error `code 3 ... click occurred before this conversion's click-through window` is not recoverable; stored as `not_uploadable`/`failed` and left alone.
- Runs hourly via cron `upload-google-ads-conversions-hourly`; a large backlog may need several runs (batch limit 200, function times out on long batches).
