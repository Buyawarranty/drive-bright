# System performance check-in form for sales staff

Sales staff get a short form they can fill in whenever the dashboard feels slow or breaks on their machine. Super admins get a new tab that turns those submissions into clear analytics: who is struggling, on which screen, on what kind of computer or connection.

## What sales staff see

A "Report a problem / rate speed" button available from their dashboard (in the existing Agent Feedback area plus a small button in the dashboard header so it's always one click away). The form asks:

- How fast did the dashboard feel? 1–5 (Very slow to Very fast)
- Which screen were you on? (New Leads, Quotes & Orders, Customers, Scoreboard, other)
- What happened? (nothing, just slow / froze / crashed / blank screen / did not save / other)
- Short description (optional, up to 1000 characters)
- How long did it take to load? (under 3s / 3-8s / 8-20s / over 20s / never loaded)

Behind the scenes the form also records their setup automatically — browser and version, operating system, device type, screen size, connection type and speed where the browser reports it, plus how long the current page actually took to load. Staff don't type any of that.

Submitting shows a thank-you message and their own recent submissions, so they can see what they've already reported.

## What super admins see

A new tab, "Staff System Reports" (super admin, admin and performance manager only), containing:

- Headline figures for the selected period: reports received, average speed rating, number of crashes/freezes/blank screens, how many staff reported at all.
- Average speed rating per agent, worst first, with their report count and last report time.
- Breakdown by screen — which parts of the dashboard get the most complaints.
- Breakdown by setup — browser, operating system, device type and connection, so a pattern like "only the two oldest laptops" or "only on 4G" is obvious.
- Trend chart of average rating and problem count per day.
- Full report list with the free-text description, expandable to show that person's captured setup.
- Date range picker (using the standard admin date filter) and CSV export.

Existing measured data already collected in the background (screen load times, crashes, errors) stays in the Sales staff app performance panel; the new tab cross-references it by showing each agent's measured average load next to what they reported, so felt-vs-actual speed can be compared.

## Technical notes

- New table `public.staff_system_reports`: `id`, `admin_user_id`, `admin_email`, `admin_name`, `role`, `speed_rating` (1-5), `screen` (text), `problem_type` (text), `load_bucket` (text), `description` (text), `browser`, `browser_version`, `os`, `device_type`, `screen_size`, `connection_type`, `downlink_mbps`, `device_memory_gb`, `cpu_cores`, `page_load_ms`, `user_agent`, `route`, `created_at`.
- Migration order: CREATE TABLE, then GRANTs (`SELECT, INSERT` to `authenticated`, `ALL` to `service_role`, no `anon`), then ENABLE ROW LEVEL SECURITY, then policies: any active admin/sales user may insert their own row and select their own rows; management/performance manager may select all. Reuse the existing `is_admin_or_sales` and `is_management` helpers.
- New `src/components/admin/feedback/SystemCheckInForm.tsx` — the form dialog; environment capture in a new `src/lib/systemEnvironment.ts` (`captureSystemEnvironment()` reading `navigator.userAgent`, `navigator.connection`, `deviceMemory`, `hardwareConcurrency`, `screen`, and `performance.getEntriesByType('navigation')`).
- New `src/components/admin/StaffSystemReportsTab.tsx` plus sub-components for the summary cards, per-agent table, breakdown cards and trend chart (recharts, matching existing analytics panels).
- Register tab id `staff-system-reports` in `src/components/admin/AdminSidebar.tsx` (management section) and in `src/pages/AdminDashboard.tsx` render switch, gated to `super_admin`, `admin`, `performance_manager` or explicit `tab_staff-system-reports` permission.
- Add the form entry point to `src/components/admin/feedback/AgentFeedbackTab.tsx` and a compact header button in the admin shell for sales/sales_lead roles.
- Verify with `npx tsgo --noEmit -p tsconfig.json` and a build.
