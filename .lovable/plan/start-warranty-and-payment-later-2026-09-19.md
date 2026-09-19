# Start warranty and payment later

A third option on the Quotes & Orders page, next to **Send Quote** and **Confirm Payment**, for customers who want to commit now but start cover and pay on a later date.

## How it works for the agent

1. Agent builds the quote exactly as now (vehicle, cover, claim limit, excess, labour rate, add-ons, price).
2. Instead of Confirm Payment, the agent clicks **Start warranty and payment later**.
3. A short dialog asks for two dates:
   - **Warranty start date** — when cover begins (must be in the future, max 60 days ahead).
   - **Payment date** — when the customer will pay (must be on or before the warranty start date, so we are never covering an unpaid vehicle).
   It also shows the same discount/floor checks as Confirm Payment — the 30% ceiling and minimum price rules still apply, and a breach still needs authorisation.
4. Agent presses Confirm. The order is created with everything captured, but marked **Pending payment** — the warranty is NOT activated, no policy documents are issued, no welcome email, nothing sent to the register.
5. The customer immediately gets an email confirming: their vehicle and cover, the price, "your warranty will start on <date>" and "your payment will be taken on <date>", plus a payment link they can use any time.

## The new Pending payment section

A new tab/section inside customer management, visible to super admin, admin, managers and the agent who did the deal (agents see only their own).

Each row shows: customer, registration, plan, amount, warranty start date, payment due date, days until due (or days overdue), last chase, payment link status.

Actions per row:
- **Send payment link** (email, WhatsApp or SMS) — logged each time.
- **Log a chase** — note saved against the customer, so the chase history is visible.
- **Change dates** — move the payment or start date, with a note recorded.
- **Mark paid / Confirm payment** — this is the single activation point.
- **Cancel order** — if the customer backs out; recorded, never silently deleted.

Colour states: green (not due yet), amber (due today or within 2 days), red (overdue).

## Activation

The warranty only goes live when payment is confirmed — either automatically (the customer pays through the link) or manually by a manager confirming external payment. At that moment the order behaves exactly like any normal sale: warranty number, policy documents, welcome email, customer dashboard, sale credited to the agent, and the start date honoured (if the agreed start date is still in the future, cover is scheduled for that date rather than starting immediately).

## Chasing and safeguards

- Automatic reminders to the customer: 3 days before the payment date, on the day, then 1, 3 and 7 days after.
- Agent reminders: a task appears in the agent's reminders on the payment date and again if it goes 3 days overdue.
- A daily digest of overdue pending-payment orders to managers.
- If it reaches 14 days overdue with no payment, the order is flagged for a manager decision (cancel or extend) — it never just sits there.
- Pending-payment orders are excluded from sales revenue figures and the daily sales summary until payment lands, then counted on the payment date, so reporting stays honest.

## Technical notes

- New columns on `customers`: `deferred_start_date`, `deferred_payment_due_date`, `deferred_status` ('pending_payment' | 'paid' | 'cancelled' | 'expired'), `deferred_created_by`, `deferred_last_chased_at`, `deferred_chase_count`. Existing `payment_verification_status` stays as-is for normal sales; the new section filters on `deferred_status = 'pending_payment'`.
- Activation reuses the existing confirm-payment path plus the scheduled-activation logic already used for future start dates (`policy_start_date` / scheduled W2000 processing), so no duplicate activation code.
- New CTA in `GetQuoteTab.tsx` alongside the two existing buttons, plus a dialog component for the dates and confirmation.
- New `PendingPaymentTab.tsx` for the management section, role-gated (managers see all, agents see their own via `assigned_to`/sale-credit chain).
- One edge function for the customer confirmation email and one scheduled reminder job for the chase cadence.
- Revenue queries updated to exclude `deferred_status = 'pending_payment'`.
