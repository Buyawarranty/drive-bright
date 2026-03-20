

## Problem

When a sales agent assigns a lead to themselves in the **New Leads** tab, it only updates the `sales_leads` table. If that lead has already purchased (has a matching customer record), the **Customer Management** dashboard still shows them as unassigned or assigned to someone else. The two dashboards are out of sync.

## Solution

Extend the `assign_lead_to_agent` database function to also update the matching `customers` record when a lead assignment changes. The match is by email (the shared identifier between `sales_leads` and `customers`).

### Step 1: Update the `assign_lead_to_agent` RPC

Add a customer sync block after the `sales_leads` update succeeds. It will:

1. Look up the lead's email from `sales_leads`
2. Find any matching `customers` record by that email
3. Update `customers.assigned_to` to the same agent
4. Update the warranty number prefix: `BAW-` to `BAW-S-` when assigning to an agent, or `BAW-S-` back to `BAW-` when unassigning (Website)

This follows the exact same logic already used in the Customer Management tab's assignment dropdown (per the memory note on purchase attribution).

### Step 2: Fix duplicate/irrelevant users in the assignment dropdown

The screenshot shows "Prajwal Chauhan" listed twice and non-sales email addresses (`support@`, `info@`) in the agent dropdown. The `fetchSalesUsers` query currently fetches ALL active `admin_users` regardless of role.

Filter it to only include roles that should appear in the assignment dropdown: `sales`, `sales_lead`, `admin`, `super_admin` — excluding support/info accounts and deduplicating by `user_id`.

### What stays unchanged
- All existing lead flow, notes, status changes, APIs untouched
- The `assignLead` function in `useLeads.tsx` stays identical — the sync happens at the database level
- Customer Management assignment dropdown remains independent
- No changes to any UI components

### Technical detail

The RPC change is a single migration adding ~10 lines to the existing function, right after the `sales_leads` UPDATE block. The dropdown fix is a one-line filter addition to `fetchSalesUsers` in `useLeads.tsx`.

