

## Plan: Restrict Unworked Leads Section to Super Admin Only + Duplicate Prevention

**Problem**: The "Unworked Leads" section is currently visible to `admin`, `super_admin`, and `sales_lead` roles. It should only be visible to `super_admin`. When these leads merge into the main list for other roles, duplicates can appear, and assignment must be preserved.

### Changes

**File: `src/components/admin/leads/NewLeadsTab.tsx`**

1. **Restrict visibility to `super_admin` only** (~line 328):
   - Change `canSeeUnworked` from `isAdminOrSuperAdmin || userRole === 'sales_lead'` to `userRole === 'super_admin'`

2. **Deduplicate merged leads** (~line 330-336): When `!canSeeUnworked` and recovered leads merge into `freshLeads`, deduplicate by checking if a recovered lead shares the same email/phone as an existing fresh lead. If a duplicate is found:
   - Keep only the original (assigned) lead, discard the recovered duplicate
   - Mark duplicates with a flag (e.g., `isDuplicate: true`) so they display a "DUPLICATE" badge
   - Ensure the lead retains its current `assigned_to` value — never overwrite an existing assignment with the recovered lead's data

3. **Duplicate badge display**: In the lead row rendering, show a small "DUPLICATE" badge (similar to existing "RECREATED" badge) when a merged recovered lead is flagged as duplicate, so super admins reviewing the data understand the state.

### Logic Detail
```
freshLeads memo:
  if (!canSeeUnworked):
    - Combine filteredLeads (all leads)
    - Group by normalized email + phone
    - For groups with multiple entries, keep the one with assignment/activity, flag others as duplicate
    - Duplicates inherit the assigned agent from the original lead
  if (canSeeUnworked):
    - Keep current behavior: split into fresh vs recovered
```

### Result
- Only `super_admin` sees the separate "Unworked Leads" section
- All other roles (admin, sales_lead, sales) see one unified list with no duplicates
- Duplicates are auto-assigned to the agent who owns the original lead
- No risk of two agents calling the same customer

