## Admin Claims Workbench — Redesign Plan

Goal: replace the dense, dropdown-driven claims table with a focused three-panel workbench so admins start from a queue, scan only decision-critical columns, and process a claim end-to-end from a right-hand drawer.

### Scope (this iteration — admin only)
- Rebuild `ClaimsManagerDashboard.tsx` as a three-panel layout.
- New components (under `src/components/admin/claims-manager/workbench/`):
  - `QueuesPanel.tsx` — left rail with queue list + live counts.
  - `ClaimsWorkbenchList.tsx` — slim middle list (rows, not wide table).
  - `ClaimDrawer.tsx` — right action drawer with tabs.
  - `EligibilityChecklist.tsx`, `AlertChips.tsx`, `DecisionActions.tsx`, `ClaimMessages.tsx`, `DocumentsPanel.tsx`, `AuditLog.tsx`.
- Reuse existing data hooks/queries already feeding `ClaimsTable.tsx`; no schema changes in this pass.
- Customer portal redesign is queued for the **next** iteration (per your "admin first" instruction).

### Layout

```text
+--------------------------------------------------------------------+
| Header: search · date range · bulk actions · new claim             |
+----------+---------------------------------+-----------------------+
| Queues   | Claim List (slim rows)          | Claim Drawer          |
| New 12   | Pri · Ref · Customer · Vehicle  | Header (status/SLA)   |
| Unass. 8 | · Issue · Status · SLA · Next   | Tabs:                 |
| Ev.Need. | · Assignee · Amount             |  Overview             |
| In Rev.  |                                 |  Warranty & Elig.     |
| Appr/Inv | (selected row highlights)       |  Documents            |
| Overdue  |                                 |  Repairer             |
| My       |                                 |  Decision (checklist) |
| High Pri |                                 |  Messages             |
|          |                                 |  Internal Notes       |
|          |                                 |  Audit Log            |
+----------+---------------------------------+-----------------------+
```

### Queues (left panel)
Derived client-side from current claims dataset; each shows a live count badge.
- New / Untriaged, Unassigned, Evidence Needed, Customer Replied, Garage Replied, In Review, Awaiting Authorisation, Approved Awaiting Invoice, Invoice Received, Payment / Completion, Declined, Closed, **Overdue SLA**, My Claims, High Priority.
- Selecting a queue filters the middle list; URL syncs via `?queue=...` so links are shareable.

### Claim list columns (middle panel)
Only decision-driving fields. Everything else moves into the drawer.

| Priority | SLA | Ref | Customer | Vehicle | Warranty | Issue | Status | Next Action | Assignee | Amount | Submitted |

- Priority = colored dot (Normal/High/Urgent).
- SLA = relative chip ("Due today", "Overdue 2d") computed from `submitted_at` + status SLA table (constants file, no DB change).
- Warranty chip = Active / Cancelled / Expired with alert color.
- Next Action computed from status (e.g. "Triage", "Chase evidence", "Authorise", "Request invoice").

### Drawer tabs
1. **Overview** — customer, vehicle, warranty, claim summary, alert chips.
2. **Warranty & Eligibility** — policy facts + Eligibility Checklist (10 items).
3. **Documents** — grouped (Customer / Garage / Admin / Warranty / Invoices / Photos / Diagnostics / Service history) with "Visible to customer" flag and "Request document" templates.
4. **Repairer / Garage** — garage contact, estimate, invoice.
5. **Decision** — checklist summary + actions: Approve, Decline, Request Evidence, Reassign, Escalate, Close. Authorisation amount input. Replaces the status dropdown as the canonical way to move state.
6. **Messages** — claim-scoped thread; clear toggle between "Customer-visible message" and "Internal note".
7. **Internal Notes** — pinned notes list.
8. **Audit Log** — system events + status transitions.

### Alert chips (shown in drawer header)
Policy cancelled · Mileage discrepancy · Within waiting period · Warranty started <14d · Vehicle not found · Duplicate claim · Open complaint · High claim value. Rules computed client-side from existing claim + customer + policy fields.

### Status lifecycle (admin-facing labels, no schema change yet)
Submitted → Triage → Evidence Needed → Evidence Received → In Review → Awaiting Authorisation → Approved Awaiting Invoice → Invoice Received → Payment Pending → Closed / Declined / Cancelled. Mapped from current status values via a `statusMap.ts` adapter so we can ship UI without a migration. Customer-friendly labels live in the same file for the next (customer) iteration.

### Out of scope this pass
- DB migrations for new statuses, SLA config, message threads, document type taxonomy — proposed but **not** applied until the workbench UI is approved, to avoid touching production data twice.
- Customer dashboard redesign.
- Repairer/garage portal.

### Technical notes
- Files touched: `ClaimsManagerDashboard.tsx` (rewrite to host the 3-panel shell), `ClaimsTab.tsx` (route stays the same). `ClaimsTable.tsx`, `Toolbar.tsx`, `BulkActionsBar.tsx`, `UrgencyBanner.tsx` kept temporarily behind a "Classic view" toggle until parity is verified, then removed.
- All colors via semantic tokens in `index.css` (`--warning`, `--destructive`, `--success`, plus new `--sla-overdue`, `--sla-due`, `--queue-active`). No hex in components.
- Responsive: drawer collapses to full-screen sheet under `lg`; queues become a `Select` under `md`.
- No new dependencies.

### Deliverable order
1. Status/SLA/alert adapter modules + tokens.
2. Three-panel shell + queues panel with counts.
3. Slim claim list with new columns.
4. Drawer with Overview / Eligibility / Decision tabs (the critical processing path).
5. Documents, Messages, Internal Notes, Audit Log tabs.
6. Remove Classic view once parity confirmed.

Approve and I'll build it in that order; reject with notes and I'll revise the plan.
