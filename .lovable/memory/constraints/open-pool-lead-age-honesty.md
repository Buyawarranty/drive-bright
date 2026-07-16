---
name: Never lie about Open Pool lead freshness
description: Open Pool lead descriptions in UI/copy/system notes must be accurate — never call them "brand-new" and never call them "recycled" (they are neither)
type: constraint
---
Open Pool leads are **never-contacted** leads (`status = 'new'`, no owner, no assignment). See `mem://admin/leads/open-pool-logic` for the full rule.

Correct phrasing in banners, toasts, system notes, RPC log_desc:
- "Never-contacted leads"
- "Waiting in the Open Pool" (implies not yet spoken to)
- "First contact needed"

**Forbidden phrasing:**
- "Brand-new leads" — misleading (they may have been created days ago)
- "Recycled leads" — wrong; recycled/re-pooled leads no longer exist under the new logic. Anything worked stays with the agent.
- "Fresh leads" — ambiguous
- Any wording that hides the actual creation age of the lead

**Why:** Sales agents and managers rely on accurate lead-state language to prioritise calls. Ambiguous or wrong descriptions destroy trust in the tool.
