## Goal

Add a parallel "B" variant of the customer journey reachable via `?step=2b`, `?step=3b`, `?step=4b`. Behaviour, APIs, Stripe, emails, lead capture — everything stays identical. The only functional difference: **on step 2b, phone number is optional** (field shown, no asterisk, form submits without it).

## How the variant is detected & carried

1. **Parse step param** — accept values like `2`, `2b`, `3b`, `4b`. Extract:
   - `currentStep` = numeric portion (existing behaviour)
   - `abVariant` = `'b'` if suffix present, otherwise `null`
2. **Persist** `abVariant` in `sessionStorage` (`baw_ab_variant`) the first time it's seen, so reloads, deep-links from emails, and Stripe return URLs keep the user in B.
3. **Rewrite every `set('step', …)`** call in `src/pages/Index.tsx` (and `StickyNavigation`, `useMobileBackNavigation`, `ThankYou`) through a small helper `formatStepParam(n)` that appends `b` when `abVariant === 'b'`. This guarantees Back/Next/redirects all stay on the B track.
4. **Stripe success/cancel URLs** built in the checkout flow get the `b` suffix when the variant is active, so users returning from payment land on `?step=4b` (or thank-you with variant preserved).

## Phone-optional change (only difference)

In `ContactDetailsStep.tsx` (the step-2 form):
- Read variant from sessionStorage / URL.
- When `abVariant === 'b'`:
  - Remove `required` from the phone input.
  - Drop "Phone Number" asterisk styling; label stays the same (no negative wording).
  - `isFormValid` no longer requires `phone`.
  - `onNext` still passes `phone` (empty string allowed) — downstream code already tolerates missing phone (abandoned-cart logic uses email as primary key).

No backend schema change required — `sales_leads.phone` and `customers.phone` are already nullable.

## Files to edit

- `src/pages/Index.tsx` — parser + `formatStepParam` helper, used everywhere `set('step', …)` is called today (lines ~588, 678, 688, 759, 766, 803, 897, 966, 1057).
- `src/components/ContactDetailsStep.tsx` — conditional `required` and validation for B.
- `src/components/StickyNavigation.tsx`, `src/hooks/useMobileBackNavigation.tsx`, `src/pages/ThankYou.tsx` — route through the same helper.
- `src/components/checkout/StreamlinedCheckout.tsx` — append `b` to Stripe `success_url` / `cancel_url` when variant active (postcode error message added previously stays).
- New tiny util `src/utils/abVariant.ts` exporting `getAbVariant()`, `setAbVariant()`, `formatStepParam(step)`, `parseStepParam(raw)`.

## What is intentionally NOT changed

- No new lead/customer columns, no admin badges, no analytics dimension (per your scope answer).
- All APIs (quote, cart, Stripe, webhooks, Warranties 2000, emails) unchanged.
- The default `?step=2` (A) flow is untouched.

## QA checklist after build

1. Visit `/?step=2b` → URL stays `2b` after submitting step 2 with **no phone** → lands on `?step=3b`.
2. Pick a plan → `?step=4b` → complete Stripe → return URL keeps `b` → thank-you renders.
3. `/?step=2` still requires phone exactly as today.
4. Reload mid-journey on `?step=3b` → stays on B.
5. Lead row appears in admin New Leads with empty phone column, no errors.

Ready to switch to build mode when you approve.
