# Step 3 pricing sandbox (super admin only)

## What you'll get

A new **"Step 3 sandbox"** tab in the admin dashboard, visible to **super admins only** (server-checked, like Price Updates). It's a safe playground where you can:

1. **Try a new step 3 design** — a copy of the website's pricing page where each 2-year and 3-year tile shows **both ways to pay side by side**:
   - **12 instalments** — the monthly figure customers know, marked as the money-saving choice ("pay over 12 months and save")
   - **BAW PayLater** — the per-year amount, collected once a year on the policy anniversary
   - To avoid confusing customers, each tile leads with **one clear price** (the 12-instalment monthly figure) and shows PayLater as a secondary "or pay £X/yr yearly" line — never two equally-sized prices competing.
2. **Follow through to a sandbox step 4** — the real checkout layout showing the **exact same prices** as the sandbox step 3, but with all payment buttons disabled. No orders, emails or customer records can ever be created.
3. **See Quotes & Orders side by side** — a review panel on the same page showing what the same plan costs in Quotes & Orders (always the website price + 10%), so you can check both surfaces at once before anything goes live.
4. **Push live when ready** — a clearly labelled button that:
   - Publishes the new prices (and later the new design) to the **website only**
   - Has an optional tick: **"Also update Quotes & Orders"** — when ticked, the Quotes & Orders grid is refreshed from the same plan, keeping the automatic 10% gap
   - Shows exactly which pricing plan is being pushed and asks for confirmation first

## How it fits the existing Price Updates logic

- The sandbox **reuses the same pricing version machinery** as Price Updates (draft plans, vehicle factors, floors, the 10% web gap). It doesn't invent a second pricing system.
- A sandbox draft is just a pricing plan draft; pushing live from the sandbox creates/publishes a version through the **same path** as the Price Updates "Push prices live" button, so both pages always agree.
- The 10% gap stays automatic: website = grid − 10%, Quotes & Orders = grid. The optional tick only decides whether the Q&O grid is re-based on the new plan.
- Nothing is ever published to the live site without you pressing the push-live button and confirming.

## Safety rules (unchanged)

- All existing protections stay in force: minimum price floors (£349/£769/£1,099), the 30% discount ceiling, net floors, vehicle exclusions.
- The sandbox checkout can never take a real payment — payment controls are disabled and clearly marked "preview only".
- Promo codes saved in the browser are ignored in the sandbox (same as the existing Step 3 preview) so you always see true grid prices.
- Nothing is published to the live website during this work — preview only, per the publishing hold.

## Technical details

- New tab id `step3-sandbox` in `AdminSidebar.tsx` + `AdminDashboard.tsx`, gated by a server-verified super-admin check (same pattern as `usePriceUpdatesAccess` / `is_management` RPC — no client-side role trust).
- New components under `src/components/admin/step3-sandbox/`:
  - `Step3SandboxTab.tsx` — layout: design preview, step 4 preview, Q&O review panel, push-live bar
  - `SandboxStep3Pricing.tsx` — the new tile design (12 instalments + PayLater yearly side by side), priced via the shared `calculateWebsiteQuotePrice` / pricing matrix so figures match the real step 3 exactly
  - `SandboxStep4Preview.tsx` — real `StreamlinedCheckout` rendered with payments disabled (a `previewOnly` prop that hides/disables payment buttons and blocks submit)
  - `QuotesOrdersReviewPanel.tsx` — same plan priced at grid (web + 10%) for comparison
- PayLater figures come from the existing `src/lib/bawPayLater.ts` helpers (`payLaterYearlyAmount`, `payLaterTermTotal`) — no new pricing maths.
- Push-live reuses the existing pricing-version publish path used by `PriceUpdatesTab.tsx`; the "also update Quotes & Orders" tick maps to publishing the grid as well as the web prices.
- Vehicle lookup for the preview reuses the `dvla-vehicle-lookup` edge function, as `Step3PreviewPanel.tsx` does.
- Small focused tests for: the dual-price tile maths (12-instalment vs PayLater yearly), the 10% Q&O gap in the review panel, and the super-admin gate. Run the existing pricing tests too.
- Verify in preview: sandbox tab hidden for non-super-admins, prices match between sandbox step 3 and step 4, Q&O panel shows +10%, push-live shows the plan name and confirms before doing anything (no actual push performed during testing).
