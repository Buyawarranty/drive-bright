

# Add "RECREATED" Tag to Duplicated Leads

## Problem
When the dedup logic catches a returning customer and updates an existing lead in-place (instead of creating a duplicate), the agent currently sees a purple "Re-sub" badge but there's no explicit warning to **stop and check before calling**. If the dedup ever fails and a true duplicate slips through, there's no visual indicator at all.

## Solution

### 1. Database: Add `is_recreated` flag
- Add a `is_recreated BOOLEAN DEFAULT FALSE` column to `sales_leads`
- In the `auto_create_lead_from_abandoned_cart()` trigger, wherever an existing lead is updated (every UPDATE path that increments `resubmission_count`), also set `is_recreated = TRUE`
- In the `recover_orphaned_leads()` function, same treatment for its update paths
- This flag stays `TRUE` permanently so agents always see the warning (unlike `resubmission_count` which just counts)

### 2. Frontend: Show "RECREATED" badge in lead rows

**LeadTableRow.tsx** (admin New Leads table):
- Add a prominent amber/red badge reading "RECREATED" next to existing badges (Re-sub, CUSTOMER, etc.)
- Tooltip: "This lead was recreated from a returning customer — check notes before calling"
- Positioned after the Re-sub badge in the badge cluster (lines ~697-720)

**SalesAgentLeadsTable.tsx** (sales agent view):
- Add the same "RECREATED" badge in the Customer column area so agents see it before calling

**useLeads.tsx**:
- Add `is_recreated: boolean` to the Lead interface and map it in the query

### 3. Files Changed
- 1 database migration (add column + update trigger functions)
- `src/hooks/useLeads.tsx` — add field to Lead type and mapping
- `src/components/admin/leads/LeadTableRow.tsx` — render RECREATED badge
- `src/components/admin/sales/SalesAgentLeadsTable.tsx` — render RECREATED badge
- `src/integrations/supabase/types.ts` — auto-updated by migration

### Technical Detail
The `is_recreated` flag is set at the database level inside the trigger, so it works regardless of whether the lead comes from an abandoned cart, a price-match callback, or the recovery cron. The flag is write-once (set to TRUE, never reset) so it persists as a permanent audit trail.

