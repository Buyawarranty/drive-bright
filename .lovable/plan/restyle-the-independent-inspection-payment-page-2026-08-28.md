# Restyle the independent inspection payment page

Bring `/independent-inspection/:token` in line with the rest of the site, without touching the payment integration. The card entry itself stays on Worldpay/Stripe (their hosted page, which we can't style), so all work here is on our form page and the handover to payment.

## What changes

**Consistency**
- Add the site header (`StickyNavigation`) and footer used on other public pages, so logo placement, colours and spacing match.
- Replace the bare `bg-muted/30` shell with the same page background and section spacing used on other public pages.
- Reuse the existing card style (same radius, border, shadow) and heading hierarchy/font sizes from the plan-selection cards — no new fonts or sizes.
- The main action button keeps the site's existing primary CTA style (brand orange, same radius, weight and hover), full-width on mobile.

**Layout**
- Single column on mobile.
- On desktop, two columns: the form on the left, a sticky summary panel on the right showing registration, inspection company, the £140 fee and turnaround time.

**Progress indicator**
- A 3-step indicator at the top — Your details, Confirm terms, Payment — reusing the existing progress indicator styling (green completed/active steps, orange track) so it matches the warranty journey. Steps reflect real state: details filled, terms accepted, paid.

**Trust signals**
- A compact trust row directly above the pay button: secure/SSL padlock, independent engineer, Visa/Mastercard/Amex card marks, and the existing Trustpilot micro widget. Styled with existing tokens so it reads as part of the page, not a bolt-on.

**Form UX**
- Inline validation: red border plus a short message under the field for the required garage name, phone and address, and for the terms checkbox, matching the destructive/error styling already in use. Errors clear as the user corrects them.
- Auto-formatting as the user types: UK phone number spacing, postcode uppercasing inside the address field, mileage kept numeric with thousand separators for display.

**Mobile**
- Remove overlap risk around the payment handover area; add safe bottom padding so the sticky/full-width button never sits under browser chrome.
- Scroll the focused field into view when the on-screen keyboard opens, so the keyboard never covers what is being typed.

## Out of scope / unchanged
- No change to `get-inspection-request`, `submit-inspection-request`, `confirm-inspection-payment`, the Worldpay functions, or the redirect/return-URL flow.
- No new colours, fonts or button variants; everything comes from the existing design tokens.
- The paid confirmation state keeps its current wording, just restyled.

## Technical notes
- Single file: `src/pages/IndependentInspection.tsx`, plus a small local trust-row block if it is not reusable from an existing component.
- Reuse `ProgressIndicator`-style markup and existing shadcn `Card`, `Button`, `Input`, `Label`, `Textarea`, `Checkbox`.
- Validation is local component state (`errors` object) validated on blur and on submit; submit still calls the same edge function and redirects to `data.checkout_url` unchanged.
- Keyboard handling via `onFocus` + `scrollIntoView({ block: 'center' })` on inputs.

After implementing, I'll capture a preview of the page on mobile and desktop widths so you can confirm it matches the rest of the site.
