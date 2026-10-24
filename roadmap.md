# Roadmap

## Renewals / New Leads parity
- [ ] Match the current New Leads column layout and shared call/note controls for linked renewals.
- [ ] Preserve renewal outcomes, eligibility, assignment and RR/ORR routing; verify available checks.

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
