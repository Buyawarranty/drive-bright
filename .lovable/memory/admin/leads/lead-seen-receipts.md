---
name: Lead seen receipts (WhatsApp-style)
description: Management can see whether the assigned agent has opened a lead; receipts are server-checked and sales-invisible
type: feature
---
- `lead_view_receipts` (lead_id, viewer_id, first/last_viewed_at, unique per pair) records who opened a lead. Writes only via `mark_lead_seen` RPC, which refuses any viewer other than the caller's own active admin_users row — receipts can never be forged for someone else.
- Read access is management-only (RLS via `is_management`); sales/sales_lead never load or see receipts.
- A lead counts as "seen" when its row is expanded in the leads table (manual or Open Pool auto-expand) — not merely scrolled past.
- UI: `CheckCheck` tick next to the assigned agent's name in the Assigned To cell — sky blue when the assigned agent has opened it (tooltip: who + when), slate grey until then. Management viewers only.
- Impersonation ("View As") never writes receipts for the impersonated agent — the RPC rejects the mismatch.
