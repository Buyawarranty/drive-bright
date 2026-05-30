## Fake Leads Audit Process

Adds an audit trail and review panel for leads marked as **Fake 404**, so managers can verify whether the agent was right to mark them fake (real number? actually tried to call? how many times? any call errors?), and review on a weekly or monthly cadence.

### What you'll see (UI)

Inside `New Leads → Fake 404` tab, a new **"Audit"** toggle (visible to `super_admin`, `admin`, `sales_lead`, `accounts_manager`) that opens an audit table with:

- **Period selector** — This week / Last week / This month / Last month / Custom range, defaulting to current month. Grouped headers show counts per week and per month.
- **Columns** per fake lead:
  - Customer (name, email, phone, reg)
  - **Phone validity** badge — green "Valid UK" / amber "Suspicious" / red "Invalid format" based on UK number regex (mobile `07xxx`, landline, international `+44`, length, repeating-digit pattern detection from existing `suspiciousLeadDetection.ts`)
  - **Call attempts** — count + expandable list of every `lead_call_logs` row: attempt #, outcome (no_answer, voicemail, wrong_number, disconnected, busy, answered, call_error…), agent, timestamp, notes
  - **Marked fake by** — agent name + date (relative + absolute)
  - **Reason** — required free-text reason captured when marking fake
  - **Audit status** — Pending / ✅ Confirmed fake / ↩️ Reinstated (with auditor + date)
- **Sort** by: Date marked fake (default desc), call count asc (zero-call ones float to top as suspicious), phone validity (invalid first).
- **Actions** per row: "Confirm fake", "Reinstate to Live", "Flag for review" (adds note + keeps pending).
- **Header KPIs**: total marked fake in period, % with zero call attempts, % with invalid phone, % confirmed vs reinstated, top fake-markers leaderboard.
- **Export** CSV (admin/super_admin only) of the current period.

### Capture flow change

When an agent picks status `Fake 404`, a small dialog now requires:
- Reason (dropdown: `wrong_number`, `no_intent`, `competitor_test`, `spam_bot`, `duplicate_test`, `other`) + optional note.

This is stored on the lead so the audit panel always has context.

### Schema additions (`sales_leads`)

- `fake_marked_by uuid` → `admin_users.id`
- `fake_marked_at timestamptz`
- `fake_reason text`
- `fake_reason_note text`
- `fake_audit_status text` — `pending` (default when fake_lead), `confirmed`, `reinstated`
- `fake_audited_by uuid` → `admin_users.id`
- `fake_audited_at timestamptz`

Index on `(fake_marked_at)` for fast weekly/monthly grouping.

Backfill: for existing `status = 'fake_lead'` rows, set `fake_marked_at = COALESCE(lost_at, updated_at)` and `fake_audit_status = 'pending'` so they appear in the audit immediately.

### Auto-population

A small trigger on `sales_leads` sets `fake_marked_by/at` whenever status transitions to `fake_lead`, and clears them (sets `fake_audit_status = 'reinstated'` + auditor) when status moves away. Frontend additionally writes `fake_reason` from the dialog.

### Files

```text
NEW  src/components/admin/leads/FakeLeadsAuditPanel.tsx
NEW  src/components/admin/leads/MarkFakeReasonDialog.tsx
NEW  src/hooks/useFakeLeadsAudit.ts
EDIT src/components/admin/leads/NewLeadsTab.tsx         (mount Audit panel under fake filter)
EDIT src/components/admin/leads/LeadTableRow.tsx        (open MarkFakeReasonDialog when picking Fake 404)
EDIT src/hooks/useLeads.tsx                             (include new fake_* columns in SELECT)
MIGRATION                                               (columns + index + trigger + backfill)
```

### Permissions

- **All agents**: can still mark fake (now via dialog with reason).
- **Audit panel view & confirm/reinstate**: `super_admin`, `admin`, `sales_lead`, `accounts_manager`. Other roles don't see the Audit toggle.
- **Export**: `super_admin`, `admin` only.

### Out of scope (call now if you want it)

- Real phone-number lookup against an external HLR/Twilio Lookup API (would catch disconnected numbers definitively but is a paid integration).
- Scheduled email digest of the weekly/monthly audit summary.

Approve and I'll ship the migration + UI.
