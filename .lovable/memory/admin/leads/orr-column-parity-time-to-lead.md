---
name: ORR column parity — only extra column is Time to Lead
description: When Open Round Robin goes live the New Leads columns stay identical; the single difference is the extra Time to Lead countdown column
type: feature
---
Agents can be switched between normal Round Robin and Open Round Robin. Their lead table must look the same either way.

**Rule:** the column set is IDENTICAL between Round Robin and Open Round Robin, with exactly ONE column difference — Open Round Robin adds a **Time to Lead** column (the reservation countdown / "Held for you" card).

- Do not add, remove, rename or reorder any other column for ORR.
- The ORR New Leads section is a single merged list containing both ORR and RR lead rows together.
- In that merged list, only ORR rows show a countdown in Time to Lead; RR rows show "No time limit — stays with this agent".
- The countdown belongs to the lead, not the agent: a lead keeps whichever system it arrived under.
- Column order stays as agreed: Agent | Time to Lead | Time to Contact · Name | Phone | Warranty | Email | Reg · Status | Calls | Actions · Customer Activity | Agent Activity · Payment | Paid Date | Lead Date.
- The sales team's full working column set must all stay in the ORR sandbox layout: #, Agent, Source, Status, Calls, Actions, Name, Phone, Warranty, Email, Reg, Payment, Agent activity, Lead date, Customer activity, Time to contact (confirmed 31 Oct 2026). Practice leads show a synthetic "Open pot" Warranty badge; live preview rows show "—"; masked until claim.

**Separate functional difference:** Open Round Robin also uses its own distribution rule (furthest-behind agent, then longest-waiting, then caps-page order). That is a routing behaviour difference, not a column difference.
