
# Agent workflow columns for Recontact Leads & Renewals

Goal: let a sales agent work the **Recontact Leads** and **Renewals** tabs the same way they work **New Leads** — see who's assigned, status, callback, call count, take quick actions (call/note/quote), and view name/phone/email/reg/payment/paid date inline.

Target columns (matching New Leads):
`Agent · Src · Status · CB · Calls · Actions · Name · Phone · Email · Reg · Payment · Paid Date`

---

## 1. Recontact Leads (`/admin-dashboard?tab=recontact-leads`)

The recontact tab (`LeadRecoveryTab.tsx`) already loads `Lead` objects from `sales_leads`, so it can reuse the existing `<LeadsTable />` directly.

- Replace its custom table rendering with `<LeadsTable />`.
- Keep the existing segment chips (Due Today / New to Recontact / No Answer / Interested / Quote Sent / Abandoned Checkout / Not Interested / All).
- Wire all the lead handlers already present elsewhere: `onUpdateStatus`, `onAssign`, `onUpdateCallCount`, `onScheduleFollowUp`, `onUpdateNotes`, `onLogActivity`, `onSendQuote`.
- Force `showSourceColumn = true` and keep `Agent` column visible (no `hideAssignedColumn`) so sales managers can see allocation.
- Preserve the "outcome" picker and "Mark worked" button on the expanded row via the existing `LeadDetailsPanel`.

## 2. Renewals (`/admin-dashboard?tab=renewals`)

Renewals are policies (`customer_policies` + `customers`), not `sales_leads`. To reuse the same table without forking it, add a thin **policy → Lead** adapter and a new table component that shares the same column layout.

- New component: `RenewalsTable.tsx` based on the same column set, rendering rows from `PolicyRow` so we don't fight the strict `Lead` typings.
- Columns map as:
  - **Agent** → `policy.assigned_agent_id` (selectable from sales/sales_lead users with the *Renewals* workstream).
  - **Src** → small badge: 🔁 Renewal / ⬆️ Upsell / 💤 Lapsed based on segment.
  - **Status** → policy retention outcome (`renewed`, `still_considering`, `no_answer`, etc. from `OUTCOMES`).
  - **CB** → callback bell driven by `lead_reminders` keyed on the customer (reuses `RemindMePopover`).
  - **Calls** → call attempt count from `lead_call_logs` keyed on customer email/phone (reuses `CallCountCell` style).
  - **Actions** → call / email / quick note / send renewal quote.
  - **Name / Phone / Email / Reg** → from `customers` (name, phone, registration_plate).
  - **Payment** → last `payment_type` on the policy.
  - **Paid Date** → `policy_start_date` (the date they last paid for this policy).
- Persist agent notes against the customer (`customer_notes`) so they stay with the record across renewal cycles.
- Persist call counts against `lead_call_logs` with the customer's email/phone so they tally across leads + renewals.
- Keep the existing segment tabs (Due Soon / Renewal Window / Upsell / Lapsed).

## 3. Shared bits

- Both tabs get the same compact `Actions` cell: 📞 call (`tel:`), ✉️ email (`mailto:`), 🗒️ inline note, 💷 send quote.
- Both tabs respect role visibility: sales/sales_lead only see their own assigned rows; managers/admins see all.
- No DB schema changes required — `lead_reminders`, `lead_call_logs`, `customer_notes`, `customer_policies.assigned_agent_id`, and `customer_policies.retention_outcome` already exist.

---

## Out of scope (ask if needed)
- Bulk actions / CSV export on the Renewals tab.
- Changing how renewal emails are scheduled — only the agent's working view is being added.
- Mobile card view for Renewals (desktop table only for now; can mirror later).

Shall I proceed?
