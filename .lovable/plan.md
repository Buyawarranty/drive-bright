# Offline Conversion Tracking — Root Cause & Fix

## The problem

Your hourly cron (`upload-google-ads-conversions-hourly`) is running every hour and succeeding at the network level, but **every conversion upload since 25 May 2026 is being rejected by Google Ads with HTTP 400**.

Sample failure from the DB (`customers.google_ads_conversion_status`):

```
failed: HTTP 400: Invalid JSON payload received.
Unknown name "userIdentifierSource" at 'conversions[0]': Cannot find field.
```

That's why ~12 recent sales are missing from "Purchase - Offline (API Import)" while older ones (uploaded before Google's v21 enforcement tightened) show as `uploaded` in our DB.

### Why it broke

In Google Ads API v21, `userIdentifierSource` is **no longer a field on the `ClickConversion` object**. It only exists on each individual `UserIdentifier` entry (and `FIRST_PARTY` is the default, so it can be omitted entirely for enhanced conversions).

Our edge function `supabase/functions/upload-google-conversions/index.ts` (lines 102–105) still sets it at the conversion level:

```ts
if (userIdentifiers.length > 0) {
  conversion.userIdentifiers = userIdentifiers;
  conversion.userIdentifierSource = 'FIRST_PARTY';   // ❌ rejected by v21
}
```

Because every recent customer has email + phone, every recent upload hits this branch and gets rejected. The cron keeps retrying them (good — nothing is lost), but they will keep failing until the field is removed.

## The fix

### 1. Remove the invalid field (the actual bug)

In `supabase/functions/upload-google-conversions/index.ts`, drop the `conversion.userIdentifierSource` line. Enhanced conversions default to `FIRST_PARTY`, which is what we want.

```ts
if (userIdentifiers.length > 0) {
  conversion.userIdentifiers = userIdentifiers;
}
```

No other changes needed — `gclid`, `conversionAction`, `conversionDateTime`, `conversionValue`, `currencyCode`, and `userIdentifiers[*].hashedEmail / hashedPhoneNumber` are all still valid in v21.

### 2. Automatic backfill (no extra work)

The cron query filters on `google_ads_conversion_uploaded_at IS NULL`, and failed rows keep that column NULL. So once the function is redeployed, the **next hourly run will retry every failed conversion automatically** — including the ~12 recent sales — and stamp them as uploaded.

(60-day cutoff still applies, so anything older than that won't backfill — but all the missed ones are within the last few weeks, so they're safe.)

### 3. Verify after the next cron tick

After the next run (top of the hour), I'll re-query the customers table to confirm `google_ads_conversion_status = 'uploaded'` for the previously-failed rows. Google Ads UI typically reflects the conversions within 3–6 hours, sometimes up to 24h.

## What I will NOT change

- Cron schedule, secrets, conversion action ID, hashing, phone normalisation, bumper enrichment, or the 60-day cutoff — all of these are working correctly.
- Client-side `gtag` purchase firing on the thank-you page — that's the separate "Purchase GTM" action and is unaffected.

## Files touched

- `supabase/functions/upload-google-conversions/index.ts` — one-line removal inside `uploadConversion`.
