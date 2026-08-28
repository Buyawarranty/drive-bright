# Worldpay checkout — status and finishing touches

## Current state (verified)

- **Customer-facing checkout** — done. `worldpay-create-payment-page` generates Worldpay's hosted payment page (card form hosted by Worldpay, PCI-safe). The 404/401 errors were fixed earlier; credentials and environment fallbacks are in place.
- **£140 appeal inspection link** — done. `Worldpay140LinkButton` is live inside the Final Appeal dialog (Claims).
- **Admin panel (`WorldpayPaymentPanel`)** — built (virtual terminal iframe + pay-by-link generator with copy button) but **not mounted on any page**, so staff can't reach it.
- **Return page (`/payment-received`)** — exists, but always shows the green "Payment Received!" success screen. Worldpay redirects back with `?status=failed`, `?status=cancelled`, `?status=error`, `?status=expired` and the page ignores that parameter, so a failed payment still looks successful.

## Proposed work

1. **Mount `WorldpayPaymentPanel`** in the admin dashboard (alongside the existing payment/quote tools) so all staff can open the virtual terminal or generate a pay-by-link and copy the URL — the "all can use it, copy the URL and share it" requirement.
2. **Fix `/payment-received`** to read the `status` param and show the right screen:
   - success/pending → current success UI (unchanged)
   - failed/error → red "payment didn't go through" state with phone number and retry guidance
   - cancelled → neutral "payment cancelled" state
   - expired → "link expired, request a new one" state
   - Only fire the `purchase` dataLayer event on genuine success.
3. **Verify** with a browser run: generate a link from the admin panel, confirm the Worldpay hosted page loads, and screenshot each status variant of the return page.

## Technical notes

- Files: `src/components/admin/WorldpayPaymentPanel.tsx` (mount point only), `src/pages/PaymentReceived.tsx` (status handling).
- No changes to the edge function, webhook, or Worldpay credentials.
