# Roadmap

## Single pricing-plan editor
- [ ] Add Edit and section shortcuts opening one named pop-up with grid, vehicle variables and website difference.
- [ ] Keep edits and whole-plan saves isolated to the selected plan; offer a named new-plan save.
- [ ] Check existing pricing tests and verify what is possible without a staff session; leave live prices unchanged.

## Expired warranties — done 23 Oct 2026
- [x] DB: `expire_overdue_policies()` + nightly cron + backfill (28 policies, 9 customers)
- [x] Customer Management: "Expired" status filter; hidden from default view; grey badge
- [x] Renewals queue includes expired policies in recently_expired / all_renewals segments
- [x] Build OK; memory saved
