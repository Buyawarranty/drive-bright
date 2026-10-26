---
name: Recontact Leads tab name
description: The recontact queue is displayed as "Recontact Leads" — never Goldmine, never "Recontacted"
type: preference
---
The queue is displayed to staff as **"Recontact Leads"**. The "Goldmine Leads" rename was
reverted at the user's request on 26 Oct 2026, and the wording "Recontacted"/"Re-contacted"
must never appear in visible labels either (the Quotes & Orders link says "Recontact Leads").

Kept unchanged underneath:
- Tab id `recontact-leads`, workstream column `workstream_recontact`, table `recontact_agent_caps`,
  segment id `new_to_recontact`, lead source `goldmine_manual`.
- Legacy URLs `?tab=goldmine-leads` and `?tab=golden-leads` still redirect to the same single tab,
  so old bookmarks keep working.
- One permission tick-box only ("Recontact Leads") — the duplicate "Goldmine Leads" entry stays removed.
