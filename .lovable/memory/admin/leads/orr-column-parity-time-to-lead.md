---
name: ORR column parity — only extra column is Time to Lead
description: When Open Round Robin goes live the New Leads columns stay identical; the single difference is the extra Time to Lead countdown column
type: feature
---
Agents can be switched between normal Round Robin and Open Round Robin. Their lead table must look the same either way.

**Rule:** the column set is IDENTICAL between Round Robin and Open Round Robin, with exactly ONE column difference — Open Round Robin adds a **Time to Lead** column (the reservation countdown / "Held for you" card).

- Do not add, remove, rename or reorder any other column for ORR.
- In a merged list (an agent holding both RR and ORR leads), only ORR rows show a countdown in Time to Lead; RR rows show "No time limit — stays with this agent".
- The countdown belongs to the lead, not the agent: a lead keeps whichever system it arrived under.
- Column order stays as agreed: Agent | Time to Lead | Time to Contact · Name | Phone | Email | Reg · Status | Calls | Actions · Customer Activity | Agent Activity · Payment | Paid Date | Lead Date.

**Separate functional difference:** Open Round Robin also uses its own distribution rule (furthest-behind agent, then longest-waiting, then caps-page order). That is a routing behaviour difference, not a column difference.
