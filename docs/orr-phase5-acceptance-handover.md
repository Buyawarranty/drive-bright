# Open Round Robin: Phase 5 acceptance and handover

Date: 29 October 2026. Scope: approved **browser-only, synthetic practice**, not the guide's production-grade server implementation. No publication or activation authorised.

## Decision

The browser rehearsal passes its focused acceptance checks. **It is not ready for live leads or production deployment.** The connected external database has not been demonstrated to be an isolated test system. Do not exercise the older operational ORR controls as part of this rehearsal.

## Evidence

- `bunx vitest run src/lib/orrPractice`: **85 passing checks in seven files**, including six new acceptance scenarios and four additional isolation checks.
- Latest preview diagnostic after code changes: **build OK**, 12:44:23 UTC.
- Browser: isolated HTML interception at localhost mounts the actual practice panel with invented input only. Verified quote details → quiet release → automatic offer → accept → voicemail → re-offer to another agent → conversation → owned/report read-back. Also verified scheduled/overdue callback, sales-lead reporting restriction and Clear cancelling/resetting automatic offers. No page runtime errors observed.
- Screenshots: `/tmp/browser/orr-phase5/owned-report.png`, `cleared-offers.png`, `management.png`, `sales-restricted.png`. Script: `/tmp/browser/orr-phase5/check_acceptance.py`.
- This is intentionally not verification of the authenticated, operational CRM shell or deployed permissions.

## Acceptance corrections

1. Bounded intake now rotates its 500-record inspection window. A 501-record fixture verifies later arrivals are evaluated on the next timestamped pass without changing record order; repeated timestamps remain idempotent.
2. Automatic acceptance rechecks capacity and the two-unworked-hold rule. Failed claims are never logged as accepted, including purchases arriving before acceptance.
3. A returning customer's journey events preserve an existing owner or exclusive reservation. Owned, purchased and suppressed records cannot be claimed through the core claim helper; owned records are excluded from Open Claim cards.
4. Clear remounts intake/offer/claim controls so old offers and review clocks cannot contaminate a fresh rehearsal.
5. Isolation checks now also cover intake, UK time, Open Claim and automatic offer modules.

## Original guide checklist disposition

| Scenario | Browser rehearsal result / limitation |
|---|---|
| Atomic claiming; exactly-at-capacity | Sequential single-browser exclusive claim and two-hold checks pass. Real simultaneous clients/transactions untested and unavailable without isolated infrastructure. |
| 20-second acceptance/decline/timeout | Pure-function checks pass, including late acceptance and mode cancellation. Recovery is manually driven, not a background worker. |
| Availability/disconnection | Expiring presence helper passes. Presence buttons are a demonstration and are **not wired to all allocation controls**; no authenticated Available/Busy/Offline lifecycle. |
| Early/late/weekend coverage; contact windows | UK calling-window and GMT/BST checks pass; internal queueing does not place calls. No holiday calendar implemented. |
| 50+ overnight enquiries; zero agents | 50-record queue/no-capacity checks pass; 501-record rotating intake acceptance passes. No durable storage or continuous process independent of a browser. |
| SLA expiry; active call; scheduled callback | Three **elapsed-minute** hold and callback deferral pass. Guide's three **eligible-minute** exception-aware hold, two-eligible-minute first-action target, active-call state and authorised timer exceptions remain unimplemented. |
| Recycling/starvation | Two-hour reviews continue without terminal cap by default; oldest-first cards and rotating intake tested. Repeated offer declines stop offers for that pool cycle; automatic retry/recycle into a fresh cycle is not implemented. |
| Existing owner and active quote | Return-to-pricing owner preservation and return-to-checkout exclusive hold pass. Calling suppression helper passes; no live quote integration. |
| Duplicate enquiry and attribution | Person-key lookup only is tested. End-to-end synthetic deduplication ingestion and production campaign preservation are not verified. |
| Manager mode switch | Pure mode switch cancels offers and leaves leads unchanged. Mode is rehearsal-local, not team/shift/pilot configuration or protected server enforcement. |
| API authorization/capacity bypass | Rehearsal role/capacity helper checks pass. No server API or RLS is implemented for the synthetic engine; UI role selectors are demonstrations, not security credentials. |
| Concurrent jobs/restart/reconnect/retry/alerts | Not implemented or tested. Refresh intentionally loses the run. No jobs, leases, persistence or operational failure alerts. |
| No live calls/messages/notifications | Checked practice source has no database/network/browser-storage operations. Telephony labels and contact results are synthetic, not verified Zoiper/Dial Nine webhooks. No live contacts used. |
| No production writes/deploy/publish/merge | None performed in Phase 5. Hosted flag state was not queried; no claim of independently verified production OFF flags. |
| Existing CRM regression | Focused sandbox view guards also checked separately. Full signed-in CRM regression remains unverified on the unmanaged external backend. |

## Inventory

Phase 5 changed `engine.ts`, `openClaim.ts`, `autoRoundRobin.ts`, `intake.ts`, `safety.test.ts`, the existing `OrrWebsiteTriggerPracticePanel.tsx`, and the roadmap; added `acceptance.test.ts` and this report. Existing synthetic modules/settings/report remain in `src/lib/orrPractice/`. **No migration, deployed function, backend connection, website tracking or messaging changes.**

## Remaining practice limitations

- Actual contact safety retains a separate configurable three-attempts-per-rolling-day gate and 15-minute cooldown, while internal two-hour re-release has no cap. This differs from a literal unlimited-contact-attempt interpretation; no real calls exist here.
- Management report is a limited read-only projection: averages and backlog/workload/callbacks, not all guide medians, SLA percentages, source/shift/campaign segmentation or fairness diagnostics.
- Offer timeout, card count, hold count and presence expiry are fixed practice constants rather than per-team configurable server settings.
- Contact results can be entered manually in practice; they do not establish genuine CRM/telephony verification. No in-progress call state is modelled.
- This report records the remaining guide gaps rather than claiming all guide requirements are delivered. Separate scope and approval are needed for further rehearsal changes; isolated infrastructure and separate authorisation are mandatory before real integrations.

## Isolation and rollback

The synthetic engine takes only in-memory invented records. Its checked modules and panel contain no network, database or browser-storage operations; no real customer records were read for this acceptance run. This boundary does **not** isolate the whole CRM: older ORR screens and the global client still reference the operational external Supabase project identified in Phase 0.

To reset a rehearsal, use Clear or reload; Clear now resets offers and review state as well as leads/agents, while leaving chosen settings intact. To withdraw the rehearsal, remove its existing panel mount using the managed source rollback process. No database rollback or production flag change is required for Phase 5. Never reset or modify real customer ownership as part of rehearsal rollback.

**Final stop:** browser acceptance and handover complete; live-system readiness not accepted. No live connection, outbound calls, tracking changes, deployment or publication without new, separate approval and verified isolation.