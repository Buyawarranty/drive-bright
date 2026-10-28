# Roadmap

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
