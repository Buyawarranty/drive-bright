# Make the Payment Assist test checkout match the main checkout

The `/steptest` checkout (used for the S17DRW quote) is a separate, older page — its own layout, pricing maths, address handling and validation. That's why it looks and behaves differently from the live Step 4 checkout.

## Approach

Stop maintaining a second checkout. Make the test page use the **real** checkout component, with Payment Assist swapped in as the monthly option.

- Give the main checkout an optional "monthly provider" setting: `bumper` (default, unchanged for all customers) or `payment_assist`.
- When set to `payment_assist`, only these change:
  - the monthly option's logo and label read Payment Assist instead of Bumper,
  - the monthly button calls the `create-payment-assist-checkout` function instead of the Bumper one.
- Everything else is inherited from the live checkout: layout, plan summary, address lookup, start date, validation and blocking rules, discount codes, pay-in-full 10% via Stripe, trust bar, mobile/desktop sticky bars.
- Pay in full via Stripe stays exactly as it is on both pages.
- The test page keeps its S17DRW-only access gate and a small "test mode" strip at the top so it is never mistaken for the live page.

## Result

`/steptest` looks and behaves identically to the main checkout, with Pay Monthly powered by Payment Assist and Pay in Full by Stripe. Nothing on the live customer checkout changes — the default provider stays Bumper.

## Technical notes

- `StreamlinedCheckout.tsx`: add optional prop `monthlyProvider?: 'bumper' | 'payment_assist'` (default `'bumper'`). Branch in `processBumperCheckout` on the function name/body, and in the monthly option's logo/label copy. No pricing changes — Payment Assist uses the same `discountedBumperPrice` / `monthlyPrice * 12` figures, keeping the Step 3 → Step 4 → admin parity rule intact.
- `src/pages/StepTest.tsx`: render `StreamlinedCheckout` (via `CustomerDetailsStep`) with `monthlyProvider="payment_assist"`, keeping the existing S17DRW authorisation and progress bar.
- `src/components/CustomerDetailsStepTest.tsx`: no longer used — delete it once StepTest is switched over.
- Payment Assist success handling already exists (`process-payment-assist-success`, `payment-assist-webhook`); no backend changes needed.
