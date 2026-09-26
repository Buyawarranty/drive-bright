---
name: Agent sales history is permanent
description: Leavers are archived, never deleted; their name stays on every sale, commission, deal and scoreboard entry
type: constraint
---
Never delete or null an agent's sales attribution when they leave. Staff with any sale are archived only (is_active=false); a DB trigger blocks deleting them. Archiving moves only open leads off them; sold leads, customers, commissions and deals keep their name so the scoreboard and Customer Management show who did each deal and when.
