# Open Round Robin: Phase 0 safety report and phased plan

## Decision: stop before implementation
The full seven-page guide has been reviewed. **Phase 0 inspection only** is authorised. Positive isolation is not established: the preview source targets the existing external Supabase project, and test-labelled ORR screens contain paths to operational settings and lead actions. No functional changes, database queries/writes, migrations, jobs, provider calls, deployment or publication were performed for this inspection. Documentation and project safeguards only were updated.

**Phase 1 is blocked on verified isolation and your separate approval.** Approving this plan is not approval to activate ORR, publish, or modify the connected customer system.

## Isolation evidence
| Boundary | Evidence | Result |
|---|---|---|
| Database | `src/integrations/supabase/client.ts:6,60` hardcodes `mzlpuxzwyrcyrgrongeb`; `supabase/config.toml:1` matches | No separate development database demonstrated |
| Authentication | Same client uses persistent auth and project-specific storage key, lines 62–68 | Different preview origins do not separate remote accounts |
| Storage | Existing client serves operational claim, CV and policy buckets | Separate storage unverified |
| Settings and ownership | `OrrGoLiveSwitch.tsx:44–83` writes `lead_distribution_settings`; `ImportLeadToAgentPanel.tsx:132–154` assigns leads and writes history | Test-screen labels are not an isolation boundary |
| Practice data | `useSandboxLiveLeads.ts:61–64` reads real contacts; `useOrrSandboxAllocations.ts:50–58,154–171` reads operational caps and writes/deletes shadow allocations on the same project | Existing rehearsal is not synthetic-only isolated integration testing |
| Live actions | `OpenRoundRobinTestPanel.tsx:811–816` calls reclaim/distribute RPCs; lines 1241–1247 update real statuses when live writes are allowed | Do not exercise these paths during Phase 0 |
| Jobs and messages | WhatsApp migration `20260913185657_13b37cae-c1c7-4dbb-a2d3-fc1a40c1a673.sql:110,131–136` targets the same project's messaging endpoint | Copied jobs/triggers must be neutralised before test use |
| Provider credentials | Source includes operational SMS, email, WhatsApp, dialler and payment paths; some individual test credentials exist | Separate accounts, deployed modes and outbound suppression unverified |

The connected project's administrative production designation, current deployed function bodies, active cron inventory and current ORR flag values were **not queried**. Existing policy is to keep ORR off; this inspection did not change or independently verify those flags. Do not infer hosted state from source comments or migration history.

## Safe prerequisite
Use a separately provisioned test Supabase project with synthetic-only records, separate Auth/Storage, no copied customer accounts or production secrets, no live webhook destinations and deny-by-default outbound communications. Switch only an isolated source copy to that test backend after verifying every client/function destination. Do not change this project's global connection during Phase 0. A source draft alone does not prove external Supabase isolation.

Before approval, provide redacted evidence of test project identity, client and function destinations, schema/table grants and policies, storage, job/trigger inventory, credentials' test-account modes, webhook URLs and communication sinks. Until supplied, the safe deliverable remains this report; no claim/concurrency tests will run against the connected system.

## Proposed sequence and approval gates
1. **Phase 1: core engine and Open Claim.** Reuse one lead record and allocation service; server-enforce three eligible minimal-information cards, two unworked claims and atomic exclusive claims. Separate reservation capacity from durable ownership; record all state transitions. Test competing claims, exact limits, unauthorised calls, refresh, workflow changes and management overrides. Stop for Phase 2 approval.
2. **Phase 2: continuous intake and recycling.** Synthetic intake only; pending/overnight/recycled views, authenticated expiring presence, contact eligibility, callback exceptions and eligible-time SLA. Server jobs must be idempotent, monitored and bounded, with starvation protection. Test 50 overnight enquiries, zero agents, early/late/weekend availability, suppressed contact, active calls, callbacks, retries and GMT/BST. Stop for Phase 3 approval.
3. **Phase 3: Automatic Round Robin.** Same authoritative engine, persistent fair cursor and exclusive 20-second offers; atomic acceptance, bounded decline/timeout recovery and safe team/shift/pilot mode changes. Preserve existing owners. Test concurrent workers, rotation, disconnects, restart recovery and mode switches. Stop for Phase 4 approval.
4. **Phase 4: management and reporting.** Audited assignment/release/escalation/settings; backlog, workload, SLA, callbacks and source-quality outcomes. Use authoritative sales records for synthetic reporting; no predictive ranking. Verify management/agent data scopes and every report calculation. Stop for Phase 5 approval.
5. **Phase 5: acceptance and handover.** Run every checklist scenario from the guide with repeatable synthetic fixtures; report passing, failing and untested cases, integrations, isolation evidence, limitations and rollback. Remain sandbox-only. Production release requires a new separate authorisation.

## Decisions to resolve before Phase 1
- The guide's **20-second acceptance, 2 eligible-minute first-action target and 3 eligible-minute unworked expiry** differ from the current 2-minute browsing/reservation model. Treat the guide as proposed new sandbox defaults; do not silently overwrite earlier settings.
- The guide requires only verifiable CRM/telephony qualifying actions. Current ownership is confirmed-contact-only; decide explicitly whether claim acceptance creates a temporary exclusive reservation while confirmed contact establishes durable ownership.
- Current chase requirement is first miss back to the same agent after 15 minutes, a 10-minute hold, then hourly 24/7 without an attempt cap. Keep this separate from unworked recycling, contact suppression and the guide's bounded-loop protection. Do not introduce a terminal chase cap silently.
- Retain the existing single Open Round Robin Sandbox home and read-only Lead Allocation reflection, rather than adding a second menu entry. Preserve the manager/agent preview toggle, existing permissions, source restrictions and ownership safeguards.
- Contact windows must be configured separately from 24/7 intake/allocation; do not change public sales phone hours or enable overnight customer calls.

## Technical proposal and dependency map
**Dependency order:** verified isolated infrastructure → identity/permissions + synthetic seed → shared transition/claim engine → presence/contact eligibility + job ledger → offers/rotation → management/reporting → acceptance.

**Existing records to inspect/reuse only in the isolated copy:** `sales_leads`, `customers`, existing quote/activity/call records, `admin_users`, `lead_teams`, `lead_team_members`, `agent_distribution_caps`, `lead_distribution_settings`, `round_robin_state`, presence records, `lead_assignment_audit`, `orr_sandbox_allocations`. Preserve existing attribution, repeat-customer ownership, renewals workstream eligibility, active quotations, customer ownership sync and protected terminal/management-hold states.

**Proposed migrations, not written or applied:** extend the existing allocation model with explicit lifecycle/reservation fields, capacity and per-scope settings; a persisted exclusive-offer/cursor mechanism; append-only transitions/reason codes; idempotent job leases/retries and contact-eligible timers. Reuse current tables where practical after hosted schema verification; exact new table names and SQL are intentionally deferred. Protect every read/write server-side with explicit grants/RLS and transaction locks, not UI checks. No parallel customer/enquiry database inside the CRM.

**Likely affected files after approval:** shared client configuration in the isolated copy; `OrrSection.tsx`, `OpenRoundRobinTestPanel.tsx`, `OrrTestLabPage.tsx`, `OrrGoLiveSwitch.tsx`, `OrrTeamSelectionPanel.tsx`, `OrrFallbackToRoundRobinPanel.tsx`, `ImportLeadToAgentPanel.tsx`; `useOrrLiveSettings.ts`, `useSandboxLiveLeads.ts`, `useOrrSandboxAllocations.ts`, reservation/presence hooks; existing ORR RPCs, relevant routing triggers and `orr-mode-integration`; focused allocation/security tests. Determine reachable versus legacy screens before changing them. Do not modify unrelated checkout, Google Ads, SEO, attendance or customer messaging logic.

**Rollback:** snapshot only the isolated test configuration/schema; disable test workers and ingress first, resolve/cancel offers without changing durable owners, revert isolated application changes, and restore/reset synthetic test data. No rollback operation will run against production. Preserve audit evidence for review.

## Phase 0 test status
- Full document reviewed; source/configuration inspection completed with file references.
- No runtime allocation, authentication, database permission, concurrency, provider or hosted-isolation tests performed, because safe infrastructure is not established.
- No app code or executable server code changed; no functional test result claimed.
- **Next checkpoint:** review this report, establish isolated test infrastructure, then explicitly approve Phase 1 and the timing/ownership decisions above.