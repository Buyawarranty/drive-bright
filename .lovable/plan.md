## Goal
Detect when customers are struggling on Step 4 (checkout/payment) and surface a real-time **red alert bar** at the top of the admin dashboard (super admin + admin only) with the customer's name and contact info so an agent can call them immediately.

---

## What counts as "struggling"
We track signals automatically from the checkout page and fire an alert when any threshold is hit:

| Signal | Threshold |
|---|---|
| Time on Step 4 without progress | > 90 seconds idle, or > 3 min total on page |
| Payment attempt failed (Stripe `payment_failed` / Bumper rejection) | ≥ 1 failure |
| Multiple payment attempts | ≥ 2 attempts in the session |
| Form field re-edits | Same field edited > 3 times (suggests confusion) |
| Switched payment method | Toggled Monthly ↔ Pay-in-Full > 2 times |
| Bumper redirect returned without success | Detected via `cancel` / back navigation |

Each event includes: customer name, email, phone, registration, device type, signal type, plan, amount, and timestamp.

---

## Build

### 1. Database
New table `checkout_struggle_alerts`:
- `customer_name`, `customer_email`, `customer_phone`, `vehicle_reg`
- `device_type` (mobile / tablet / desktop)
- `payment_method` (stripe / bumper)
- `signal_type` (timeout / payment_failed / multi_attempt / form_thrash / bumper_cancelled)
- `details` (jsonb — failure message, attempts count, etc.)
- `plan_name`, `amount`
- `status` (`active`, `acknowledged`, `resolved`) — auto-resolves when the customer pays
- `acknowledged_by`, `acknowledged_at`, `resolved_at`
- Realtime enabled
- RLS: only `admin` and `super_admin` can read/update

Auto-resolve trigger: when a matching payment lands in `customers` (by email + reg), mark alerts resolved.

### 2. Client-side tracker
New hook `useCheckoutStruggleTracker.ts` mounted inside `StreamlinedCheckout.tsx` (Step 4 only):
- Idle timer + page-time timer
- Listens to Stripe payment errors and Bumper failures
- Watches form-field edit counts and payment-method toggles
- Inserts into `checkout_struggle_alerts` (debounced; one row per session per signal type)

### 3. Edge-function hook
In `create-payment-intent` and `create-bumper-checkout`, on caught errors, also insert an alert row (server-side fallback, since some failures never reach the browser).

### 4. Admin UI — Red Alert Bar
New component `CheckoutStruggleAlertBar.tsx` mounted at the top of the admin dashboard layout (visible only to `admin` / `super_admin`):
- Bright red sticky bar pinned above the dashboard content
- Subscribes via Supabase realtime to `checkout_struggle_alerts` where `status='active'`
- Shows the most recent customer:
  > 🚨 **John Smith** is stuck on checkout (Stripe, mobile) — AB12 CDE — 07xxx xxxxxx — *Payment failed: card declined*
- Buttons: **Call now** (tel:), **Acknowledge** (marks as seen), **View** (jumps to that customer/lead), **Dismiss**
- If multiple active alerts: shows count badge "+3 more" with dropdown
- Plays a subtle ping sound on new alert (super admin only, can mute)

### 5. Where the bar appears
Mounted once at the top of the admin shell so it's visible on every admin tab.

---

## Files to add / edit

**New**
- `supabase/migrations/...sql` — `checkout_struggle_alerts` table + RLS + realtime + auto-resolve trigger
- `src/hooks/useCheckoutStruggleTracker.ts`
- `src/components/admin/CheckoutStruggleAlertBar.tsx`

**Edit**
- `src/components/checkout/StreamlinedCheckout.tsx` — mount the tracker
- `src/components/checkout/DesktopOrderSummary.tsx` — emit payment-method-toggle signal
- `supabase/functions/create-payment-intent/index.ts` — log server-side failures
- `supabase/functions/create-bumper-checkout/index.ts` — log server-side failures
- Admin dashboard shell (the layout that wraps admin tabs) — mount `CheckoutStruggleAlertBar`

---

## Open questions before I build

1. **Sound on new alert** — want a soft ping for super admins, or silent (visual-only)?
2. **Auto-dismiss timing** — should an unacknowledged alert auto-hide after, say, 30 minutes if the customer abandoned? Or stay until manually dismissed?
3. **Which admin shell file** mounts the dashboard? I'll find it (likely `src/components/admin/AdminDashboard.tsx` or similar) — confirm if you have a preferred location.

Reply with answers (or just "go" for: silent, 30-min auto-hide, top of admin dashboard) and I'll build it.
