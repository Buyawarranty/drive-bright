# Open Round Robin sandbox — new design

Rebuild the ORR practice sandbox to match the supplied design (Open_Round_Robin_CRM_Dashboard_1.png). Everything stays in practice mode with made-up leads: nothing real is written, no customer is contacted, no agent figures change. ORR stays off.

## 1. Agent view — working screen

- **Next Available Opportunity card** at the top: one shared lead at a time, first to claim. Shows only Lead Ref (e.g. BW-89421), Source, Lead Type badge (Overnight / Live / Callback), Age, Calls (today/total), Chase Day (Day x of 8) and a green **Claim Lead** button. Customer name, phone, email and reg stay hidden until claimed.
- **Working table below** keeps every column the sales team uses today: #, Lead Type, Agent, Src, Status, Calls, Actions (call / Notes / WhatsApp), Name, Phone, WhatsApp, Email, PDF, Payment, Paid Date, Agent Activity, Lead Date, Customer Activity, Time to Engage.
- Tabs: **My Leads**, **All Leads**, **Callbacks**, **Follow-ups**, with search, filters and column toggle.
- Rules enforced: maximum 2 unworked claimed leads per agent; no penalty for not claiming; no full backlog view for agents.

## 2. Manager view — full queue and control

- **Stat cards row**: Total Leads, Ready Now (in pool), Overnight (waiting), Next Release time, Available Agents (x/y), Active Leads (assigned), Max per Agent.
- **Queue table**: Lead Ref, Lead Type, Source, Status (Ready Now / Claimed / Held (Callback)), Calls, Chase Day, Age, Assigned Agent, Next Release, and an Assign action.
- **Agent Capacity side panel**: each agent's used/free slots (e.g. 1/2) plus availability states (Available, On Call, On Break) from the corrected availability rules.
- Tabs: **ORR Queue**, **All Leads**, **Release Schedule**, **Agent Capacity**, **Performance**, **Audit Log** (practice data only).
- Managers keep the existing Sales agent view / Manager view toggle.

## 3. Controlled 9:00am release (new logic)

- At each release window (9:00, 12:00, 2:30, 5:00 UK) the system counts available, eligible agents and their free slots, and releases only enough leads to match capacity (e.g. 6 agents x 2 slots = max 12 leads).
- As agents claim and free capacity, more leads are released from the overnight backlog.
- Remaining overnight leads stay queued for the next window or until capacity opens.
- New pure module `src/lib/orrPractice/capacityRelease.ts` + tests: given pool backlog, agent availability and free slots, compute how many and which leads (oldest first) to release. Existing release-schedule, no-sale ladder, availability and claim rules are reused unchanged.

## 4. What does not change

- All existing New Leads columns and sales-team workflow stay intact.
- The live New Leads rotation, real lead data and all live CRM behaviour are untouched.
- Existing practice rules (2-minute browsing window, 2-minute claim reservation, 8 chase days / 32 releases, no-sale block ladder, break grace, no penalty for not claiming) carry over.
- Nothing is published; preview only.

## Technical notes

- Main work: `OpenRoundRobinTestPanel.tsx` (agent working screen), `OrrSection.tsx` / `OrrSandboxTabView.tsx` (manager view shell), new `capacityRelease.ts` + tests in `src/lib/orrPractice/`.
- Synthetic Lead Refs (BW-#####) generated for practice leads only.
- Design tokens only; no hardcoded colours. Build verified with the existing ORR test suite (114 tests) plus new capacity-release tests.
