---
name: See all sales agents data switch
description: Per-agent Lead Allocation switch (default off) controlling whether sales staff see other agents' names on deals in Customer Management
type: constraint
---
Lead Allocation has a per-agent switch "See all sales agents data" (lead_team_members.can_see_all_agent_data, default OFF). When off, sales agents and sales leads in Customer Management see only their own name on their own deals — every other agent's name shows as "Sales agent", the agent filter lists only themselves, and the assignment-handover history panel is hidden from them. Management (admin, super_admin, sales_manager) always sees everything. Only management can toggle the switch. Never show other agents' names/emails to sales staff without this flag.
