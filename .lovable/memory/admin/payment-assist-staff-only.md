---
name: Payment Assist is staff-side only
description: Customer checkout never uses Payment Assist (monthly goes via Bumper); the /steptest rehearsal page exists for the two test plates but shows no TEST MODE banner
type: constraint
---

Payment Assist is a staff-side tool only (admin panel, payment links into Payments Pending). The live customer checkout never uses it — monthly payments run through Bumper.

The `/steptest` rehearsal page (src/pages/StepTest.tsx) still exists: it is the real checkout with `monthlyProvider="payment_assist"`, reachable only for test plates S17DRW and RV19OWW (redirect in src/pages/Index.tsx). On 28 Oct 2026 the purple "TEST MODE — MONTHLY PAYMENTS RUN THROUGH PAYMENT ASSIST" banner was removed at the user's request — the page must look like the normal checkout, with no test-mode strip.
