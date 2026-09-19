---
name: Start warranty and payment later
description: Pay-later orders on Quotes & Orders — warranty stays off until payment lands, chased in the Pending Payment tab
type: feature
---
Third CTA on Quotes & Orders beside Send Quote and Confirm Payment: **Start warranty and payment later**.

- Agent completes the whole order, then agrees two dates: warranty start date (future) and payment date, which must be on or before the start date (never cover an unpaid vehicle). Enforced by trigger `trg_validate_deferred_payment_dates`.
- Order saved with `status = 'Pending Payment'`, `deferred_status = 'pending_payment'`, policy `status = 'pending_payment'`. No documents, no welcome email, nothing to the register.
- Customer is emailed straight away (`send-deferred-order-email`, kind `confirmation`) with cover start date, payment due date and a payment link.
- **Pending Payment** tab (`pending-payment`): management/accounts see all; sales and sales_lead see only their own orders. Actions: send payment link (Worldpay pay-by-link), log chase, change dates, record payment, cancel (management only). Green / amber / red by due date.
- Activation happens only when payment is recorded: status Active, policy active (or scheduled if the agreed start is still future), welcome email + documents sent, sale counted from the payment date.
- `deferred-payment-chase` runs daily at 09:05 London: customer reminders at −3, 0, +1, +3, +7 days (once each, tracked in `deferred_reminders_sent`), manager flag at 14 days overdue, daily overdue digest to accounts@/support@/info@.
- Pending-payment and cancelled deferred orders are excluded from revenue reporting and the daily sales summary until paid.

## Payment reminders (Sep 2026)
Every pay-later email (confirmation, agent-sent link, automatic reminder) carries **both** payment routes: a Worldpay card link ("Pay now by card") and a Bumper spread-the-cost link ("Spread the cost with Bumper"). Links are created when the order is saved and stored in `deferred_payment_link` / `deferred_bumper_link`; reminders reuse them.

Customer reminder cadence, relative to the agreed payment date: 7 days before, 3 days before, 1 day before, on the day, then 1, 3, 7 and 10 days overdue.

Sales agent chase reminders (to the agent who took the deal, resolved from `deferred_created_by` → `sale_credit_admin_user_id` → `assigned_to`): 1 day before, on the day, then 3, 7 and 14 days overdue. Tracked once-only in `deferred_agent_reminders_sent`; each one also logs a note on the customer. Manager digest at 14 days overdue is unchanged.
