# Roadmap

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
