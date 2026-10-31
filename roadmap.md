# Roadmap

## ORR Lead Ref is the reg plate — 31 October 2026
- [x] "Lead Ref" now shows the registration plate that arrives with the lead, everywhere it appeared: practice working table, manager queue, agent Next Available Opportunity card, audit log and the claim notice. The synthetic BW-89421-style numbers are gone.
- [x] Made-up practice leads are given their own fresh UK-format plate (nextPracticeReg in src/lib/orrPractice/leadBadges.ts) instead of every row repeating TEST123; live-mode leads keep their real plate from sales_leads.
- [x] Headers read "Lead Ref (Reg)"; the plate is no longer masked before claim (it is the identifier), while name, phone, WhatsApp and email stay hidden until claimed.
- [x] 132 ORR practice tests pass (3 rewritten lead-ref checks), typecheck clean, preview build OK. Sandbox only — nothing published.


## ORR source follows the lead-source permission — 31 October 2026
- [x] Open Round Robin source display now follows the same entitlement as New Leads (admin/super_admin, ADS@/SEO@ default, every sales role always denied): sandbox Src column + show/hide control, manager queue table, agent opportunity card, morning release and both live queue panels. Inside the rehearsal the source only appears in the manager view.
- [x] 146 tests pass (2 new lead-source checks), typecheck clean, preview build OK. Sandbox only — nothing published.

## Separate ORR practice screens — 31 October 2026
- [x] Separate sales agent working screen from manager controls, retaining existing columns and the shared practice run; manager setup/live preview collapsed separately.
- [x] 131 practice checks and 5 view-switch access checks pass; preview build OK. No publication or live activation.
- [ ] Signed-in screen verification unavailable because the project uses external unmanaged Supabase.

## ORR sandbox new dashboard design — 31 October 2026
- [x] User supplied new design mockup (agent working screen + manager queue & control); plan approved. All existing New Leads columns retained in the working table.
- [x] Built practice-only: capacity-matched controlled release (src/lib/orrPractice/capacityRelease.ts — release only enough leads to match available agents × free slots, max 2 unworked each, top-ups as capacity frees, backlog waits), synthetic Lead Refs + lead-type badges (leadBadges.ts), agent Next Available Opportunity card with details hidden until claimed (OrrNextOpportunityCard.tsx), manager stat cards / slim queue table with Assign / Agent Capacity panel with On Break toggle / Release Schedule / Performance / Audit Log tabs (OrrManagerControl.tsx), agent tabs My Leads / All Leads / Callbacks / Follow-ups with masked unclaimed details.
- [x] 136 ORR tests pass (17 new), app typecheck clean, preview build OK. Sandbox only — ORR not live, nothing published.
- [ ] Signed-in on-screen verification unavailable on external unmanaged Supabase.

## ORR corrected inactivity & availability rules — 31 October 2026
- [x] User uploaded corrected rules doc (truncated at "### 6. Sandbox" — rest requested if it exists). Agreed: build in sandbox, 60-minute break grace.
- [x] Built practice-only in src/lib/orrPractice/availability.ts: voluntary claiming (no strikes for unclaimed leads), telephony-driven Busy with status restore, On Break with 60-min penalty-free lead recycling, strict 5-condition inactivity events (single event recycles, 3+ in 5 days flags manager review), manual Busy/manager corrections when telephony unavailable.
- [x] Wired into settings (breakGraceMinutes, inactivityReviewThreshold), openClaim (only available agents can claim), and OrrLogicExplainer (documented rules + manager controls). 114 ORR tests pass; preview build OK. Sandbox only — nothing live or published.

## ORR no-sale block ladder — 31 October 2026
- [x] Rule agreed with user: 1 sale-free working day = 1 day out of new ORR leads, 2 = 2, 3 = 3; capped at 3 days then flagged for management review; any confirmed sale resets to zero; new starters exempt for 14 calendar days; Mon–Sat only count (Sundays/days off never).
- [x] Built practice-only in src/lib/orrPractice/noSaleBlock.ts (pure, no Supabase/network); manager controls (on/off, cap 1–7, grace 0–60) added to OrrLogicExplainer and OrrPracticeSettings; rehearsal roster skips held-out agents and shows an amber status note (fake history: Thomas 3 sale-free days, Liam in grace).
- [x] 10 new tests + all 104 ORR practice tests pass; preview build OK. Sandbox only — ORR not live, nothing published.

## Bing verification + 31 Oct publish
- [x] Full site publish requested by user on 31 Oct 2026 and confirmed serving on drive-bright.lovable.app (Bing verification meta tag present, correct title). Pre-publish scan: info/warn only, no criticals; no blog drafts pending.
- [x] Bing records read for https://buyawarranty.co.uk/ through the connected account: site listed, not yet verified; meta-tag code and DNS verification code both returned.
- [x] Bing XML verification file placed in the website root (public/BingSiteAuth.xml, user code 00D53323EA471A8451D6CD58B51D4911); preview serves it at /BingSiteAuth.xml as text/xml.
- [ ] buyawarranty.co.uk is NOT served by this project: it resolves to Hostinger (A 77.37.83.235 / 77.37.53.248, nameservers ns1/ns2.dns-parking.com, SOA dns.hostinger.com) and runs an older copy of the same app (no Bing tag; /BingSiteAuth.xml returns the homepage HTML fallback, not the file). Bing's XML verification attempt on 31 Oct confirmed it cannot reach the file there.
- [ ] User chose: point buyawarranty.co.uk at this project, then publish. Connect card staged (byo_connect — user adds the shown DNS records at Hostinger). After DNS verifies and SSL provisions, publish so the Bing file + tag go live on the domain, then user clicks Verify in Bing. Warn: keep Hostinger MX/email records untouched; the Hostinger copy of the site stops serving once DNS flips.



## Lead-source permission — 31 October 2026
- [x] Latest rule applied server-side and in display: ADS@/SEO@ source defaults, every sales role denied regardless of grants; exports and ownership unchanged. Eighteen tests pass, preview build OK. ADS@ is active; no SEO@ staff account currently exists, but future matching accounts inherit the rule. No publication.
- [x] Lead source is a separate On/Off switch in Edit user permissions. Protected scoped grant controls New Leads, Recontacted Leads and Customer Management; removed conflicting legacy controls and display restrictions without widening record access.
- [x] Twelve permission/export regression tests pass; preview build OK. Nothing published.
- [ ] Real signed-in switch save/read-back unavailable on external unmanaged Supabase; isolated browser mounting failed, so visual/end-to-end verification is not claimed.

## Emailed payment form validation — 31 October 2026
- [x] Reuse Step 4 mobile/name rules, immediate ticks/errors, quiet empty fields, submit focus/pulse and mileage confirmation; preserve quoted prices and provider routing.
- [x] 24 shared regression checks pass; desktop/mobile fixture verifies immediate warnings, correction, submit blocking/focus and low-mileage confirmation through payment invocation. Payment endpoint deployed; website unpublished. No real quote or payment exercised.

## Company sales totals privacy — 30 October 2026
- [x] Company sales-value pages blocked before permission grants and render/menu paths; team scoreboard now returns self rows without team aggregates. Company-target RLS and four reporting shortcuts block sales/sales_lead. Assistant sales tools refuse those roles; own prices/scores retained.
- [x] Nineteen frontend privacy tests and database checks across active sales accounts pass; preview build OK, no new security warnings (603 existing findings separate). Nothing published; database protections already apply to the connected service.
- [ ] Real signed-in UI verification unavailable on external unmanaged Supabase; full saved regression transaction remains available for rerunning with an elevated test connection.

## CRM at departure — 30 October 2026
- [x] Added Open saved CRM inside Leaver archives: frozen assigned leads, own accessible customers, permissions and recorded session/location/access history, with UK/UTC dates and source references. Pre-departure capture now runs before offboarding; archive RPC status update precedes queue cleanup. Older views unavailable, management-wide screen reconstruction explicitly excluded.
- [x] Approved plan implemented; three frontend tests and rollback-only database checks cover filter/secret sanitisation, immutable snapshots, repeated archives, two-month visibility and 24-hour approval expiry. Isolated browser verifies viewer/tabs/pagination; recording endpoint rejects invalid tokens; preview build OK. No publication or real staff deactivation. No new linter warnings; 612 existing findings remain separate.
- [ ] Real authenticated departure-to-viewer read-back remains unavailable on externally managed Supabase. Exact screen replay and historic unrecorded filters cannot be supplied; new page/filter recording reaches the published client only after explicit publication.

## Staff deactivation timeout — 30 October 2026
- [x] Database logs confirm status updates rolled back during repeated missing-contact recovery in the offboarding lead update; contact trigger now skips unchanged contact details, preserving edits, clear-field protection, archives and existing allocation rules.
- [x] Three temporary-row database checks pass: clear-field protection, recovery after contact edits, and owner-only updates without contact recovery. Deployment confirmed; preview build OK. No employee or stored lead changed during testing.
- [ ] Authenticated Deactivate/sign-out UI verification is unavailable on external unmanaged Supabase; no real employee switched off for testing.

## ORR phased sandbox updates — 29 October 2026
- [x] Phase 0 source inspection: full guide reviewed; shared external Supabase client, operational controls and communication/job paths show no verified isolation. Safety report and phased plan prepared; documentation only, no database access/writes or functional changes.
- [x] Website lead triggers and continuous re-release rehearsed in practice mode only: two-minute quiet release, three-minute claim hold, two-hourly round-the-clock review with no attempt cap, ownership only from a confirmed conversation with voicemails disregarded, permitted calling hours kept separate from intake, and a one/two/five-minute comparison table. Runs on invented customers and cannot reach the live system. Forty-two checks pass; preview build OK; nothing published.

- [x] Phases 1–3 approved and implemented as synthetic in-memory practice: Open Claim, continuous intake/recycling, and 20-second automatic offers.
- [x] Phase 4: synthetic backlog, agent workload, separate first-attempt/conversation averages and samples, escalation and pending callback reports; management-only rehearsal settings/report views. All 75 practice tests pass; isolated browser verifies backlog, callback timing, role restrictions and changed inactivity setting; preview build OK. Nothing published or connected to real customers.
- [x] Phase 5 browser-only acceptance/handover: 85 practice checks pass; corrected bounded-intake starvation, acceptance-time capacity, failed-offer status, returning-customer ownership and Clear/reset state. Isolated browser verifies offer/voicemail/conversation/report/reset plus callback and role restrictions; build OK. Full checklist and remaining guide gaps recorded in `docs/orr-phase5-acceptance-handover.md`.
- [ ] Real-system readiness remains blocked: verified isolated infrastructure and separate approval required for durable server allocation, authenticated permissions/presence, exception-aware eligible timers, concurrent jobs and telephony integrations. Nothing published, deployed or activated.

## Blog 19 BMW family comparison
- [x] Published Blog 19 only through the existing database-backed article route; all nine original internal links remain in order, all eight sections/two tables/five FAQs retained, original image compressed from 2.7 MB to 316 KB without crop or replacement. Corrected variant-specific boot figures and relevant BAW terms; no unsupported repair prices or reliability rates added.
- [x] Live browser verifies search title/description, self-referencing canonical, followed links, original inline image, footer and five-question schema. Database HTML and schema exactly match staged article source. Seven targeted tests pass; preview build OK.
- [x] Author byline added: article now credits David Yash at the bottom with his "Automotive Specialist" label and bio card, matching every other recent article. His name also replaced the company name in that article's own search-engine author markup and page details. Verified in the browser and in the page's structured data; staged article source updated to match.

- [x] Whole-site publish requested and completed 31 Oct 2026 to drive-bright.lovable.app; staged crawler article, metadata and sitemap shipped there. [ ] buyawarranty.co.uk itself still resolves to Hostinger and serves a copy without the Lovable build, so the crawler article is not yet live on the real domain — connect the domain to Lovable or update the Hostinger copy.

## Concise customer quote email
- [x] Removed inaccurate claims hours and authored dash punctuation in shared HTML and both text alternatives; shortened cover copy, moved clickable quote link and CTA above details, preserved sender and delivery logic.
- [x] Mobile and desktop email rendering checked: button within first 154px, two clickable quote links, no overflow. Three quote-edit persistence checks pass; preview build OK. Public SPF and DMARC records exist, but provider DKIM alignment and actual inbox delivery remain unverified. No publication, sender deployment or customer test send.

## Checkout town and apartment search
- [x] Corrected Postcoder autocomplete URLs and town/street drill-down. Four regressions pass; live checkout finds Wembley, narrows to streets and confirms Flat 7, Silchester Apartments with town and postcode. Address service deployed; website not published.

## Step 3 sticky pay-in-full saving
- [x] Show genuine savings below the old £30 display threshold, including £25; guard sticky labels against £1 without changing payable prices.
- [x] Nineteen pricing checks pass; real quote journey shows £468 monthly total, £422 in full and £46 saving in Step 3 and Step 4. Phone sticky saving visible without overflow; preview build OK, nothing published.

## Checkout phone validation
- [x] Confirmed two 19:24 Payment Assist attempts had ten-digit UK mobiles; shared Step 2/Step 4/server validation now rejects incomplete mobiles consistently, retaining valid saved numbers and the optional Step 2 variant. Example is 07960 123 456; prices and routing unchanged.
- [x] Four shared-validator tests pass; isolated checkout preserves the saved valid number, rejects a ten-digit mobile inline and clears the error when corrected. Preview build OK. No real payment submitted or site publication; live completion remains unverified.

## Excess display wording
- [x] Website checkout summaries and chat cover summary use Excess and amount only; pricing, policy explanations and claim limits unchanged. Nothing published.

## Goldmine administrator releases
- [x] Limit releases to 100 and admin/super_admin only; self-claim endpoints fail closed and all release controls use the guarded allocation RPC. Existing list visibility and newest-first selection retained.
- [x] Visible name is now "Recontacted Leads" across sidebar, heading, permission tick-boxes, Lead Teams, allocation matrix, caps/access panels, toasts and tooltips; internal ids, tables, RPCs and URL aliases unchanged.
- [x] Thirteen focused frontend tests and database role/self-claim checks passed; preview build OK. Nothing published or ORR enabled.
- [ ] Actual release/read-back is blocked: no agent currently has Goldmine workstream enabled; authenticated browser verification unavailable on external unmanaged Supabase. Existing security findings unchanged.

## Trace future lead access
- [x] Append-only lead open/phone copy history stamps real actor and time server-side with current lead RLS; admins/super_admin read per-lead history with GMT timestamps and pagination. Main detail/full-notes views and row/banner/corner/new-lead/checkout/failed-payment/missed-call/lost-lead copy controls wired.
- [x] Server test confirms alternate actor/time ignored and append-only privileges; inherited privileges removed. Four audit tests plus eleven privacy/request tests pass; preview build checked. Admin lead detail contains paginated GMT access history.
- [ ] Authenticated path: UNVERIFIED on external unmanaged Supabase. Guest events intentionally denied. Existing published client does not emit new events until explicit publication; browser failures/direct manual access cannot be guaranteed recorded, and past copies cannot be reconstructed.

## Failed-payment panel owner and admins only
- [x] Red panel blocks other staff before requests/subscriptions; assigned agents require fresh verified ownership for rows, sounds and claims. Checkout-alert RLS now denies blanket sales-manager/other-staff access; admin/super_admin retained. Claims reject zero-row results and delayed requests cannot restore prior ownership maps. Allocation unchanged.
- [x] 22 focused frontend tests and deployed database role/contact checks pass; preview build OK, nothing published or ORR activated. No new security warnings; prior findings remain separate.
- [ ] Authenticated on-screen verification unavailable on external unmanaged Supabase.

## Close sales lead and checkout-alert data-access gap
- [x] Added five restrictive lead read/update/delete and checkout-alert read/update policies with private current-owner predicates; contact-owner RPC now respects RLS. Existing permissive staff policies and public/system capture unchanged.
- [x] Deployed database regressions exercise sales and temporarily rolled-back sales_lead identity against real own/other/unassigned/held lead reads, checkout ownership and contact lookup; management access retained. Thirteen popup tests pass; preview build OK, ORR off, no publication. No newly introduced security warnings; 607 pre-existing findings remain outside this fix.
- [ ] Authenticated on-screen own/other-alert verification unavailable with external unmanaged Supabase. Existing already-delivered browser data cannot be recalled by RLS.

## Real /auth staff single-session enforcement
- [x] Add a token-validated active-staff-only revoke-others action, independent of device approval, and await it in /auth staff password sign-in before dashboard/renewal navigation. Existing device flow unchanged; restored/refocused sessions do not revoke.
- [x] Eighteen focused frontend/edge tests pass; browser fixture submits real /auth form and verifies normal staff and role-error fallback revoke once, customers skip revocation, and failure stays on /auth. Preview build OK; not published.
- [ ] Real two-browser authenticated revocation read-back unavailable with external unmanaged Supabase; existing access tokens remain valid until expiry even after refresh sessions are revoked.

## Individual agent activity view
- [x] Daily staff activity defaults to one block per agent: their name as a heading with their own day bars, range totals and session counts beneath, ordered by recorded active time; "By day" keeps the combined day-by-day view.
- [x] Twenty tests pass; isolated browser confirms each agent heading appears once, per-agent day rows and totals, session detail from an agent's own day, timeline and by-day views, and phone layout scrolls without page overflow. Preview build OK; nothing published.


## Graphical daily active and idle review
- [x] Add all-staff daily comparison bars above attendance table and session timelines with recoverable final-interaction idle windows, explicit session start/end details and honest historical data gaps; recording and permissions unchanged.
- [x] Twenty-three tests pass; isolated browser verifies daily active/idle totals, offline staff, repeated sessions, idle window, sign-out details and date controls without runtime errors or mobile overflow. Preview build OK; nothing published.
- [ ] Full historical idle transitions cannot be reconstructed from stored endpoints; complete future active/idle interval recording requires a separately scoped server-ledger change. Real signed-in read-back remains blocked by external unmanaged Supabase.

## Clear earliest CRM presence
- [x] Primary first-presence column combines existing session starts and paginated RLS-protected location observations, labels source and separates first/last recorded interactions. Observation failures explicitly warn that earlier presence is unavailable; no active-time or historical-gap invention.
- [x] James's 09:06 versus 11:47 rule tested; 13 tests pass and preview build OK. Isolated browser shows earlier observation, later interaction, date-race protection and no runtime errors; nothing published.
- [ ] Real signed-in first-presence UI read-back unavailable with external unmanaged Supabase; unknown periods before detailed recording cannot be reconstructed.

## Yesterday attendance loading and history
- [x] Fixed shared busy/date-change race: independent date requests load immediately and stale results cannot overwrite the selection. Two dedicated regressions and 13 attendance tests pass.
- [x] Database counts confirm 11 daily records and 160 sessions on 26 October, zero overlapping sessions for 25 October. Source has no attendance pruning and no matching scheduled cleanup found; stored history is not deleted by date selection. Prior unrecorded activity cannot be reconstructed.
- [x] Isolated browser verified delayed Today → immediate Yesterday, correct historical result after Today completed and staff search; no runtime errors, preview build OK, public route protected. Nothing published.
- [ ] Real authenticated UI read-back unavailable with external unmanaged Supabase; changes remain preview-only and cannot recover missing 25 October session records.

## Staff location and multiple-destination review
- [x] Include recorded work locations/IP/device types and GMT first/last seen within live attendance; share selected dates and staff filter with paginated RLS-protected reads.
- [x] Highlight accounts with multiple recorded networks/places/device types, provide flagged-account filter and location search; do not infer physical computers or auto-block IP changes. Restricted device decisions and access scopes unchanged.
- [x] Seventeen location/attendance tests pass; preview build OK. Isolated sample verified locations, IP/device/times, flags, search and date/staff scope with no runtime errors; public route remains protected. Nothing published or activated.
- [ ] Same-login blocking remains unavailable until trusted administrator enrolment, full access-path enforcement and authenticated verification are complete; browser credentials do not establish hardware identity. Real location report read-back unavailable with external unmanaged Supabase.

## Daily staff session timelines
- [x] Show every recorded session split by day, a per-agent daily timeline, click-through session details and staff search with existing customer-style quick/custom date filters; honour ltPeriod links.
- [x] Saved-login connections resume with a fresh session after a stale heartbeat; distinguish actual sign-out from last-seen disconnection and unavailable computer-lock evidence. Fifteen tests pass including repeat sessions and the 25-hour UK clock-change day; preview build OK.
- [x] Isolated browser sample verified daily rows, repeated visits, continued sessions, sign-out, quick/custom dates and no runtime errors. Public staff route redirects to authentication; no publication or device-enforcement activation.
- [ ] Real authenticated recording/report read-back remains unavailable with external unmanaged Supabase; timeline represents recorded connections, not proof of continuous human presence or computer locks.

## Approved-device staff access
- [x] Added private approved-browser records, admin-only approval/revocation, password-verified Sales login attempt logging, requested device registration and staged shared-guard checks. No device auto-approved; restrictions remain OFF.
- [x] Staff access & security log combines device requests, successful/failed/blocked attempts through the new sales sign-in service, recent CRM online state, in-page admin alerts, available IP locations and GMT times alongside attendance/history.
- [x] Twelve frontend tests and two edge tests pass; preview build OK; signed-out log redirects to /auth without runtime errors. Service-only function privileges verified.
- [ ] Activation blocked on trusted administrator browser enrolment and authenticated end-to-end read-back, unavailable with external unmanaged Supabase. No enforcement toggle exposed.
- [ ] Complete enforcement across custom staff edge endpoints, direct Realtime/storage paths and PostgREST hook before enabling. Existing public endpoints identified in read-only audit also need separately verified integration authorization. Browser bearer credentials are not hardware-bound and do not prevent deliberate credential/token copying; use a stronger device-bound factor for that threat.

## CRM attendance and access history
- [x] Bring attendance, recorded locations and protected sign-in/access records together in Attendance; include inactive staff history and explicit GMT timestamps. Sign-in audit is admin/super-admin only; service-only RPC omits raw auth payloads.
- [x] Timestamp/activity tests passed, preview build OK; signed-out Attendance redirects to /auth without runtime errors. Function privileges verified service-only; login and allocation behaviour unchanged.
- [ ] Authenticated report/UI read-back unavailable for external unmanaged Supabase. Anonymous/failed attempts are not in the historical staff audit source; exact individuals behind shared accounts and hacking cannot be established from these records.

## Visible pricing editor and live comparison
- [x] Saved-plan Open and Load into editor now open the full named editor immediately, including grid, vehicle variables and website difference.
- [x] Shared read-only comparison shows matching live/plan Q&O and Step 3 totals, pound/percentage changes and Q&O versus Step 3; grid live labels now use the published matrix rather than code defaults. No pricing or publication changes.
- [x] 29 targeted pricing tests passed; preview build OK. Isolated Playwright fixture verified Open, Load into editor, comparison totals and vehicle shortcut with screenshots and no runtime errors.
- [ ] Real signed-in save/read-back remains unavailable with external unmanaged Supabase. Additional existing claim-limit test expects 939 but current unchanged engine returns 1033; pricing left untouched.

## Sales own-lead pop-ups
- [x] Closed notification-bell, WhatsApp reply and policy-linked authorisation-result ownership gaps; suppressed unassigned Open Pool nudges for sales/sales leads. Screenshot's checkout alert already checks current lead ownership; management and allocation unchanged.
- [x] 21 ownership/privacy regression tests passed; preview build OK, protected access redirects to sign-in without runtime errors. Signed-in notification read-back remains unavailable with external unmanaged Supabase; nothing published.
- [x] Own-lead checks cover new-lead, failed-payment, stuck-checkout, price-beat and recent alerts; reminder and resubmission alerts use current assignment. Unscoped and website-chat pop-ups remain blocked for sales/sales leads, even with permission overrides; allocation and management access unchanged.
- [x] 19 ownership/privacy regression tests passed; preview build OK and protected route redirects to authentication with no runtime errors. Nothing published.
- [ ] Signed-in own/other-lead alert read-back is unavailable with external unmanaged Supabase.

## Own-lead imports and optional attendance bar
- [x] Restrict shared import search and Quotes & Orders manual/prepopulated import to the sales/sales lead viewer's own assigned leads; skip customer/cart fallback and recheck current ownership. Registration autofill uses the same own-agent scope.
- [x] Default their personal New Leads progress/attendance bar off; add management-controlled per-agent own-bar switch and shortcut in Lead Allocation without changing tracking or management reports. All six current team settings remain off.
- [x] 24 regression checks passed; preview build OK and public access remains protected with no runtime errors. Database restrictions applied; app display changes unpublished.
- [ ] Signed-in import and switch save/read-back unavailable with external unmanaged Supabase.

## Customer-data export permissions
- [x] Admin/super-admin default export access; every other staff role requires a new explicit Export files grant. No grants pre-enabled.
- [x] Export files control in Edit user permissions; protected grant table permits only admin/super-admin creation and removal. Old per-tab grants/email prefixes no longer confer export access.
- [x] Shared live check protects customer/lead CSV and Excel, claims PDF/CSV, cancelled/refunded lists, abandoned carts, audiences, recovery, customer login/email logs, chatbot data and lead notes/call summary exports; existing record visibility unchanged.
- [ ] Signed-in permission grant/revoke and download read-back: unavailable with external unmanaged Supabase. Updated app export controls remain unpublished; existing production client is unchanged until publication.

## Live CRM attendance
- [x] Extend existing attendance with meaningful CRM time, first/last use, CRM-open and explicit sign-out session history; all staff and Today are defaults.
- [x] Management-only all-staff reporting, service-only writes with staff identity checks, per-user capped time and no mouse-only/synthetic browser events; existing allocation presence unchanged.
- [x] 14 activity/access tests passed, preview build OK, public route gated and deployed endpoint rejects invalid tokens with 401; nothing published.
- [ ] Authenticated recording/report read-back: unavailable with external unmanaged Supabase; browser interaction signals reduce casual fakery but cannot prove genuine work or defeat determined browser automation. CRM-open times are not separate authentication-login audit records; unexpected closes show estimated last connection.

## Call permissions and inbound naming
- [x] Make Call data permission explicit and default-off for sales agents and sales leads across menu and direct access.
- [x] Rename visible Call Rail wording to Call inbound without changing tracking.
- [x] Eight access regression tests passed and preview build OK; signed-in verification unavailable with external unmanaged Supabase.

## Renewals / New Leads parity
- [x] Match normal New Leads column widths; linked renewals use the shared live call counter, dial/email/reminder controls and expandable full notes.
- [x] Preserve renewal outcomes, eligibility, assignment and RR/ORR routing; seven existing call/ORR tests pass, preview build OK, protected route redirects without runtime errors.
- [ ] Signed-in call/note save and visual comparison: unavailable with external unmanaged Supabase session; requested New Leads screenshot has not been attached.

## Dial 9 call timing and Adam's totals
- [x] Measured active two-minute import: Adam's 114 calls on 23 Oct all correctly owned; completed-call arrival median 56.1s, p95 106.3s, maximum 119.5s.
- [x] Corrected the detailed table's one-time-only load: visible 30s refresh, refresh on return, manual refresh, full pagination and error retention; call credit unchanged.
- [x] Two refresh tests passed; build OK. Signed-in UI verification unavailable with external unmanaged Supabase.

## Single pricing-plan editor
- [x] Add Edit and section shortcuts opening one named pop-up with grid, vehicle variables and website difference.
- [x] Keep edits and whole-plan saves isolated to the selected plan; offer a named new-plan save.
- [x] 49 pricing tests passed; public access redirects to sign-in without runtime errors; live prices unchanged.
- [ ] Authenticated save/read-back and pop-up visual checks: unavailable with external unmanaged Supabase session.

## Expired warranties — done 23 Oct 2026
- [x] DB: `expire_overdue_policies()` + nightly cron + backfill (28 policies, 9 customers)
- [x] Customer Management: "Expired" status filter; hidden from default view; grey badge
- [x] Renewals queue includes expired policies in recently_expired / all_renewals segments
- [x] Build OK; memory saved

## Shorter phone-number error message — done 28 Oct 2026
- [x] One shared short wording everywhere: "Enter a UK mobile number, e.g. 07960 123 456" (Step 2, Review & Pay, monthly-payment server check). Rule unchanged — 07 with 11 digits.
- [x] 6 phone tests pass; verified live in preview: short message on one line, clears when a valid mobile is typed. Nothing published.

## Step 4 cover summary rows
- [x] Review & Pay summary now lists Cover duration, Claim limit, Excess, Labour rate, Parts covered and No. of claims (Unlimited) on both phone and desktop layouts; prices, cover terms, claim limits and routing unchanged. Verified live on 1280px and 390px viewports. Nothing published.

## Step 2 live field warnings
- [x] First-name box warns while typing (a single letter shows the red message straight away), matching the email and mobile boxes; an empty box stays quiet until the button. Shared pure helper plus three tests pass; preview build OK and verified live in the browser after a real registration lookup. Nothing published.

## Rapid lead-opening alert — built 28 Oct 2026
- [x] Limit agreed: 30 lead openings or number copies in 10 minutes. Only openings with no call afterwards count — a dial that rings out or reaches voicemail is real phone work and never trips it.
- [x] Database tables live: security_alerts, editable limit/window/mailboxes, and a trigger that wakes the check when someone passes the limit (no standing timer, so nothing runs when nobody is working).
- [x] Edge check deployed: reads the last 10 minutes, matches each opening to a call by lead or by the number dialled, names the person, and emails info@ and support@ with opened / called / reached / no-call figures. Verified it runs and that it refuses calls without project keys.
- [x] Admin-only Live Alerts card added showing the same figures with a link to the staff access log; 15 tests pass and the preview build is clean.
- [ ] Nothing published: lead openings are recorded by the app itself, so the table is still empty until the site is published — no alert can fire before then.
- [ ] A real test email has not been sent: it would read as a genuine incident in info@ and support@. Say the word and I'll fire a clearly-labelled one.
- [ ] Second code at admin sign-in and new-place sign-in alerts still awaiting your decisions (who needs it, authenticator app or text, and where the alerts go).
