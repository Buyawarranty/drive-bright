
## What I found

This is not primarily round-robin “changing its mind”.

There are 3 separate causes behind the same customer appearing under different people:

1. **Some reassignments are manual**
   - The lead changelog shows real assignment flips done by staff.
   - Example: lead `692bff87...` (`petervwilcox@aol.com`, reg `A10 WLX`) was changed:
     - James → Ash
     - then Ash → James
   - Both changes were logged as user actions, not automatic round-robin.

2. **Orphan cart migration bypasses the assignment-protection logic**
   - `auto_create_lead_from_abandoned_cart()` is correct: on dedup it updates the existing lead and intentionally keeps `assigned_to`.
   - But `migrate_orphan_carts_to_leads()` directly inserts into `sales_leads` and does **not** run the same dedup/assignment-protection rules.
   - That means the same customer can end up with multiple active `sales_leads` rows assigned to different agents.

3. **The leads UI deduplicates by newest email row, not by the “owner” row**
   - `useLeads.tsx` keeps the most recent row per email.
   - So if duplicate lead rows exist for the same email across agents, the visible row can appear to “switch owner” depending on which duplicate is newest.
   - This conflicts with your intended rule: the original/active assigned lead should remain the canonical one.

## Root cause summary

Your database logic already tries to preserve original ownership for repeat submissions, but one recovery path (`migrate_orphan_carts_to_leads`) bypasses that rule, and the frontend then surfaces the wrong duplicate as the visible lead.

## Plan to fix

### 1) Stop creating duplicate active leads from orphan carts
Update `migrate_orphan_carts_to_leads()` so it follows the **same dedup + assignment-preservation** logic as `auto_create_lead_from_abandoned_cart()`:
- match by normalized email and normalized phone
- if an active lead already exists, update that row instead of inserting a new one
- never overwrite `assigned_to` during automated recovery
- increment `resubmission_count` / refresh metadata on the existing row

### 2) Make the UI show the correct “owner” row
Update `useLeads.tsx` deduping so the canonical row is chosen by:
1. assigned lead with activity/history
2. then most recently updated
3. then newest created row

This ensures the visible lead stays with the original assigned agent instead of jumping to whichever duplicate row is newest.

### 3) Keep manual reassignment as the only way ownership changes
Preserve current manual reassignment tools, but keep automated flows from changing agent ownership unless a staff user explicitly changes assignee.

### 4) Clean up existing conflicting duplicates
Add a one-time cleanup migration/data fix to identify active duplicate `sales_leads` for the same email/phone and:
- keep the row with assignment/activity/history
- archive or merge the weaker duplicate rows
- preserve latest useful vehicle/cart details on the kept row

### 5) Verify with changelog + sample records
After implementation, verify:
- repeat submissions stay on the same assigned lead
- orphan migration no longer creates conflicting active rows
- visible assignee in New Leads matches the canonical row
- manual reassignments still work and remain audit-logged

## Files / areas likely to change

- `supabase/migrations/...`  
  - patch `migrate_orphan_carts_to_leads()`
  - add duplicate cleanup/backfill
- `src/hooks/useLeads.tsx`  
  - fix canonical dedupe selection logic
- optionally related admin lead recovery views if duplicate/archive behavior needs a badge or filter update

## Expected outcome

After this fix:
- round-robin will only decide the **first valid owner**
- repeat/returned leads will stay with that agent
- only an explicit staff reassignment will move a lead to someone else
- the dashboard will stop making duplicates look like ownership is changing
