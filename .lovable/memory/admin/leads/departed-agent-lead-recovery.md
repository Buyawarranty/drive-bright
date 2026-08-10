---
name: Departed agent lead recovery is all-time and generic
description: Recover Leads counts and pulls any leaving agent's ex-owned unassigned leads across all time, never limited to the chosen date range
type: feature
---
- Applies to EVERY agent who leaves, never hardcoded to one person. Archived agents appear in both dropdowns with a "(left)" suffix.
- "Include leads this agent used to own that are now unassigned" resolves leads via `lead_assignment_audit.previous_assigned_to_id` and deliberately IGNORES the From/To range — a departed agent's leads span their whole tenure, so a narrow range silently drops most of them.
- Selecting a source agent shows a live all-time counter: unassigned ex-owned, still workable (excludes converted/lost/fake_lead/do_not_contact/unsubscribed), and any leads still assigned to them.
- Recovered batches split round-robin across the selected target agents; paid/converted leads keep their status.
