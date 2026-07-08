# Claims Workspace Rebuild

Transform the current claim modal into a proper claim case-management workspace. The list stays as triage; clicking a claim opens a dedicated full-page workspace at `/admin-dashboard/claims/:id` (route `AdminClaimDetail` already exists — we'll upgrade what it renders and route to it from the list). The modal is kept as an optional quick-preview only.

## Scope

### 1. Routing & entry points
- Claims list row click → navigate to `/admin-dashboard/claims/:id` (full page) instead of opening `ClaimDrawer` as a modal.
- Keep a small "Quick preview" affordance (eye icon) on the row that still opens the drawer for a glance.
- Add a "Back to claims" breadcrumb (already present in `AdminClaimDetail`).

### 2. Sticky claim header
Top of the detail page, always visible on scroll:
- Customer name · Claim ref (`BAW-<REG>`) · Vehicle + reg · Opened date · Days open / SLA badge
- Editable **Status** dropdown (see lifecycle below)
- Editable **Priority** dropdown (Normal / High / Critical) — decoupled from status, reversible, with reason prompt when changing to/from Critical
- Assigned agent picker
- Primary action buttons: Update status · Request evidence · Approve · Reject · Add note · Upload document · Log call · Escalate/De-escalate

### 3. Claim summary panel
Facts card directly under header:
Vehicle · Registration · Warranty start · Days on risk · Mileage at purchase · **Mileage at claim (editable, audited)** · Miles driven since purchase · Claim limit · Labour rate · Voluntary excess · Reported issue · Customer contact · Garage details (new optional fields).

Field edits write to `claim_audit_log` (who / when / from → to / optional reason).

### 4. Tabs under summary
- **Overview** — reported issue, warranty snapshot, timeline summary
- **Documents & Evidence** — all customer-uploaded files from Make a Claim + agent uploads. Each row: name, type, source (customer/agent/system), uploaded by, date, internal label, visibility (internal / customer-visible), preview + download
- **Notes** — private internal notes, timestamped, author
- **Communication History** — every email sent (evidence requests, status updates, replies) with full body preview
- **Calls** — manual "Log call" entries (who, outcome, summary, follow-up date) + any CallRail records
- **Decision & Settlement** — approved amount, excess deducted, final paid, payment date, payment method, garage/customer paid, invoice ref, settlement notes. Feeds the Amount column in the list.
- **Appeal** — appears when status = Appealed. Shows original decision, appeal reason, new evidence, appeal status, final outcome.
- **Audit trail** — chronological log of every important change.

### 5. Status lifecycle (replaces current `open/closed/…`)
`new → in_review → evidence_requested → evidence_received → decision_pending → approved → awaiting_payment → paid → closed`
Parallel: `rejected → (appeal_submitted → appeal_in_review → appeal_approved | appeal_rejected) → closed`
Rejected ≠ Closed. Closed = fully archived.

### 6. Request evidence — compose-first flow
Replace blind auto-send. Clicking **Request evidence** opens a composer:
- Pick evidence types (checkbox list: diagnostic report, garage invoice, photos, video of fault, service history, odometer photo, MOT history, repair estimate, proof of breakdown)
- Pick a template (general / suspension / engine / steering / electrical / mileage clarification)
- Generated email is fully editable before send
- On send → logged into Communication History and Audit trail

### 7. Manual document upload
"Upload document" button in Documents tab. Fields: file, type/label, visibility (internal only vs customer-visible), note. Stored in existing `customer_documents` (or a new `claim_documents`) with `uploaded_by_role`.

### 8. Log call — proper form
Replace ambiguous button with a modal form: who was called (customer / garage / other), outcome, summary, follow-up required + date. Saved record appears in Calls tab and Timeline.

### 9. Audit trail
New `claim_audit_log` table: `claim_id, actor_id, actor_name, action, field, old_value, new_value, reason, created_at`. Written for: status change, priority change, assignee change, mileage edit, settlement edits, evidence requests, document upload, manual notes creation.

### 10. List view queue tabs
Above the claims table, add queue chips: Active · Evidence requested · Approved / awaiting payment · Paid · Rejected · Appealed · Closed · All. Chip counts reflect the new statuses.

## Technical details

- **Route**: `AdminClaimDetail` already mounted at `/admin-dashboard/claims/:id` (via `ClaimDrawer fullPage`). We'll replace its body with a new `ClaimWorkspace` component tree in `src/components/admin/claims-manager/workspace/`:
  - `ClaimHeaderSticky.tsx`
  - `ClaimSummaryCard.tsx`
  - `tabs/OverviewTab.tsx`, `DocumentsTab.tsx`, `NotesTab.tsx`, `CommsTab.tsx`, `CallsTab.tsx`, `SettlementTab.tsx`, `AppealTab.tsx`, `AuditTab.tsx`
  - `dialogs/RequestEvidenceDialog.tsx`, `LogCallDialog.tsx`, `UploadDocumentDialog.tsx`, `StatusChangeDialog.tsx`, `PriorityChangeDialog.tsx`, `SettlementForm.tsx`
- **List → workspace**: update the claims table row click handler in `ClaimsManagerV2` / `ClaimsWorkbench` to `navigate('/admin-dashboard/claims/' + id)` and add a "Quick preview" eye icon that keeps drawer behaviour.
- **DB migrations** (all with GRANTs + RLS to `authenticated`):
  - `claim_audit_log` (claim_id, actor_id, actor_name, action, field, old_value, new_value, reason, created_at)
  - `claim_settlements` (claim_id, approved_amount, excess, final_paid, payment_date, payment_method, paid_to, invoice_ref, notes, created_by, updated_at)
  - `claim_appeals` (claim_id, reason, new_evidence, status, outcome, created_at, closed_at)
  - `claim_call_logs` — reuse existing `lead_call_logs` pattern, scoped to claim
  - Extend `claims_submissions.status` enum: add `in_review, evidence_requested, evidence_received, decision_pending, approved, awaiting_payment, paid, rejected, appeal_submitted, appeal_in_review, appeal_approved, appeal_rejected` (keep legacy `open, closed` for back-compat, migrate on read)
  - Extend `claims_submissions` with `priority`, `garage_name`, `garage_phone`, `garage_email` if missing
- **Hooks**: `useClaimAuditLog`, `useClaimSettlement`, `useClaimAppeal`, `useClaimCommunications`, extend `useClaims` to return new fields.
- **Amount column** on list = `claim_settlements.final_paid ?? claim_settlements.approved_amount ?? legacy amount`.
- **Evidence composer**: new edge function `send-claim-evidence-request` (or extend existing `send-claim-update-request`) that accepts subject/body/checked-types, sends via Resend, writes to `claim_communications` + audit log.

## Delivery order

1. DB migrations (statuses, priority, audit log, settlement, appeal, garage fields) + hooks
2. `ClaimWorkspace` shell + sticky header + summary card, wired into existing `/admin-dashboard/claims/:id` route
3. Tabs: Overview, Documents (with manual upload), Notes, Comms, Calls
4. Settlement tab + Amount column wiring
5. Request-evidence composer + Log-call form + Status/Priority dialogs with audit writes
6. Appeal tab + Audit tab
7. List queue chips + row-click routing change + quick-preview eye icon

## Out of scope for this pass
- Customer-facing appeal submission portal (agent-side only for now)
- Automated SLA breach alerts (badge shows days open; alerting is later)
- CallRail deep integration beyond showing existing linked records

---

This is a large change (roughly 15–20 files + 3–4 migrations). Confirm and I'll ship it in the delivery order above — or tell me to trim/reorder (e.g. skip Appeal + Audit tabs for v1, or start with just the workspace shell + Settlement + Evidence composer).