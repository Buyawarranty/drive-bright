

# New "Sales Lead" Role Implementation

## Overview

Create a new **Sales Lead** role (team leader/manager) that sits between Admin and Sales Agent. This role can assign leads to sales agents, set daily targets, monitor agent activity, and view all leads and customers -- while the existing **Sales Agent** role becomes restricted to only seeing leads assigned to them.

## Current System

- Roles exist as a Postgres enum: `admin`, `customer`, `member`, `viewer`, `guest`, `blog_writer`, `sales`
- Sales agents (`sales` role) already have a restricted dashboard (`SalesAgentDashboard`) showing only their assigned leads
- Lead assignment is handled via `admin_users.id` in `sales_leads.assigned_to`
- Distribution settings, agent caps, and presence tracking are already in place

## What Changes

### 1. Database: Add `sales_lead` to the `user_role` enum

A new enum value `sales_lead` will be added so it can be assigned via `user_roles` and `admin_users` tables.

### 2. Database: Daily Targets Table

A new `agent_daily_targets` table to let Sales Leads set targets per agent:

```text
agent_daily_targets
+-------------------+--------+----------------------------------+
| Column            | Type   | Purpose                          |
+-------------------+--------+----------------------------------+
| id                | uuid   | Primary key                      |
| agent_id          | uuid   | FK to admin_users.id             |
| set_by            | uuid   | FK to admin_users.id (the lead)  |
| target_date       | date   | Date the target applies to       |
| target_leads      | int    | Number of leads to contact       |
| target_sales      | int    | Number of sales to close         |
| actual_leads      | int    | Auto-tracked: leads contacted    |
| actual_sales      | int    | Auto-tracked: sales closed       |
| notes             | text   | Optional notes from sales lead   |
| created_at        | timestamptz | Auto                         |
| updated_at        | timestamptz | Auto                         |
+-------------------+--------+----------------------------------+
```

RLS: Sales Leads can read/write targets for agents; agents can read their own targets.

### 3. Permission Template

A new `sales_lead` template in `src/lib/permissions/templates.ts` granting:
- **New Leads**: full view of ALL leads, ability to assign leads to agents
- **Customers**: full view of ALL customer purchases
- **Analytics**: team-level view
- **Agent Activity**: view presence, daily online time, interaction logs
- No access to admin-only tabs (user permissions, document mapping, etc.)

### 4. Frontend: Sales Lead Dashboard

A new `SalesLeadDashboard` component with tabs:

- **All Leads** -- see every incoming lead, assign/reassign to agents
- **Agent Overview** -- see all agents, their assigned leads count, activity status, daily targets vs actuals
- **All Customers** -- full customer/purchase view (existing `CustomersTab`)
- **Set Targets** -- set daily lead/sales targets per agent per day
- **My KPIs** -- team-level metrics (total leads, conversion rate, revenue)

### 5. Frontend: Routing Logic Updates

In `AdminDashboard.tsx` and related files:
- Add `sales_lead` to the `adminRoles` array so the role grants dashboard access
- Add `sales_lead` to `rolePriority` between `member` and `sales`
- Route `sales_lead` users to the Sales Lead Dashboard by default
- In `NewLeadsTab.tsx`, give `sales_lead` the same lead visibility as admin (all leads) plus assignment capability

### 6. Sales Agent Restrictions (Reinforced)

Confirm the existing behaviour:
- Sales agents can ONLY see leads where `assigned_to` matches their `admin_users.id`
- Sales agents CANNOT self-assign leads (the `claim_lead_for_agent` function already prevents this for agents not meeting criteria, but we add an explicit UI block)
- Purchases/customers tab for sales agents only shows orders linked to their assigned leads

### 7. Auth & Login Updates

- Add `sales_lead` to the `adminRoles` arrays in `SalesLogin.tsx`, `Auth.tsx`, `PasswordReset.tsx`, `CustomerDashboard.tsx`, `useAuth.tsx`, and `AdminLoginDebug.tsx`
- The sales login portal will accept `sales_lead` role users

### 8. RLS Policy Updates

- Update `is_admin_or_sales` function to include `sales_lead` role
- Sales Lead users get full read access to `sales_leads`, `abandoned_carts`, and `customers` tables
- Sales Lead users can UPDATE `sales_leads.assigned_to` (assign leads)

## Technical Details

### Files to Create
- `src/components/admin/sales/SalesLeadDashboard.tsx` -- main dashboard
- `src/components/admin/sales/AgentOverviewPanel.tsx` -- agent activity/targets view
- `src/components/admin/sales/SetTargetsPanel.tsx` -- target setting UI

### Files to Modify
- `supabase/migrations/` -- new migration for enum + table
- `src/lib/permissions/templates.ts` -- add `sales_lead` template
- `src/lib/permissions/types.ts` -- add to `ROLE_HIERARCHY`
- `src/pages/AdminDashboard.tsx` -- routing for `sales_lead` role
- `src/components/admin/leads/NewLeadsTab.tsx` -- `sales_lead` gets full lead view with assignment
- `src/hooks/useAuth.tsx` -- add to role arrays
- `src/pages/SalesLogin.tsx` -- add to allowed roles
- `src/pages/Auth.tsx` -- add to admin roles
- `src/pages/CustomerDashboard.tsx` -- add to admin roles
- `src/components/PasswordReset.tsx` -- add to admin roles
- `src/components/admin/AdminLoginDebug.tsx` -- add to admin roles

### Migration SQL Summary
```text
1. ALTER TYPE user_role ADD VALUE 'sales_lead'
2. CREATE TABLE agent_daily_targets (with RLS)
3. Update is_admin_or_sales() to include 'sales_lead'
```

## Scope Summary

| Capability                        | Sales Lead | Sales Agent |
|-----------------------------------|:----------:|:-----------:|
| View ALL incoming leads           |     Yes    |      No     |
| Assign leads to agents            |     Yes    |      No     |
| Self-assign leads                 |      No    |      No     |
| View only assigned leads          |      No    |     Yes     |
| Set daily targets for agents      |     Yes    |      No     |
| View agent activity/presence      |     Yes    |      No     |
| View ALL customer purchases       |     Yes    |      No     |
| View own customer purchases       |      No    |     Yes     |
| Export data                       |   Limited  |      No     |
| Manage user permissions           |      No    |      No     |

