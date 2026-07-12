# Phone Logs & Open Pool Verification System

This is a big spec. I'll build it in phases so you can see progress and course-correct. Below is the full plan; I'll ship Phase 1 first (the Phone Logs admin page + tracking) since that's what you explicitly asked for at the top, then continue into verification + restrictions.

## Phase 1 — Phone tracking + Admin → Phone Logs page (ship first)

**Database (new tables):**

1. `phone_events` — one row per trackable phone action. Immutable append-only audit.
   - `id`, `agent_id` (admin_users.id), `agent_name`, `lead_id`, `lead_type` ('sales_lead' | 'abandoned_cart'), `customer_id` (nullable), `phone_number`, `event_type` (see list), `selected_outcome` (nullable), `source_page`, `reservation_id` (nullable), `session_id`, `ip_address`, `metadata` jsonb, `created_at`.
   - `event_type` enum values: `phone_clicked`, `spoken_to_selected`, `no_answer_selected`, `voicemail_selected`, `busy_selected`, `callback_requested`, `wrong_number_selected`, `not_interested_selected`, `retry_started`, `retry_completed`, `retry_missed`, `reservation_expired`, `manager_confirmed_match`, `manager_confirmed_mismatch`, `manager_unable_to_verify`, `restriction_applied`, `restriction_ended`.
2. `phone_event_verifications` — manager review results linked to `phone_events.id` (result, manager_id, notes, recording_url, created_at).
3. `open_pool_restrictions` — active + historical restrictions. `agent_id`, `level` (1..4), `mismatch_event_id`, `duration_active_hours` (nullable — days for higher levels), `active_hours_remaining`, `starts_at`, `ends_at` (computed against agent schedule), `status` ('active' | 'ended'), `reason`.
4. Grants + RLS on all three (agents see their own, admin/super_admin/sales_manager see all; only service_role writes verifications + restrictions from an edge function).

**Tracking hooks (frontend):**

- New `logPhoneEvent(...)` helper in `src/utils/phoneEventLogger.ts` — fire-and-forget insert into `phone_events`.
- Wire it into every existing "Call" / phone-icon click site (LeadTableRow, LeadDetailsPanel, LeadsMobileCards, customer detail, claim detail — grep for `tel:` and click-to-dial).
- Wire it into the Quick Log outcome buttons in `UnifiedNotesPanel.tsx` (Spoken to / No answer / voicemail / busy / callback / wrong number / not interested).
- Include the current Open Pool reservation ID when present.

**Admin Panel → Phone Logs page:**

- Route: `/admin/phone-logs`, added to admin sidebar under a new "Admin Panel" grouping labelled "Manage your warranty business".
- Summary cards: Phone clicks, Unique leads attempted, Spoken to selected, No answer selected, Verified Spoken to, Confirmed mismatches, Retry calls due, Missed retries, Agents restricted from Open Pool.
- Filters: date range (uses standard admin date filter), agent, lead source, customer search, phone number, selected outcome, manager verification status, retry status, restriction status.
- Table columns: Date, Time, Agent, Customer, Phone, Lead source, Event, Selected outcome, Recording, Manager result, Retry status, Restriction status.
- Row click → drawer with full call + activity timeline for that lead (reuses existing `UnifiedNotesPanel` timeline data).
- Pagination + CSV export (respects role-based export limits per existing memory).
- Access control: admin / super_admin / sales_manager only. Sales_lead/sales are excluded (only their own events visible on their own dashboards, not on this page).

## Phase 2 — Manager verification controls

- On each Phone Logs row with `event_type = spoken_to_selected`, managers get 3 buttons: **Confirmed spoken to**, **Confirmed mismatch**, **Unable to verify** + optional notes + recording URL field.
- Writes into `phone_event_verifications` and appends a new `phone_events` row (`manager_confirmed_*`) — never mutates the original event.
- Bulk "review queue" filter: unverified `spoken_to_selected` events from last 48h.

## Phase 3 — Automatic Open Pool restrictions

- Edge function `apply-open-pool-restriction` triggered on `manager_confirmed_mismatch`:
  - Counts prior confirmed mismatches for that agent in the relevant window (30d / 90d).
  - Applies ladder: 4 active hrs → 1 working day → 3 working days → 7 working days.
  - Writes `open_pool_restrictions` row with `active_hours_remaining` + computed `ends_at` from `agent_schedules`.
  - Sends in-app notification via existing `customer_notifications` pattern (or `admin_users` inbox).
- `useOpenLeadPoolReservation` + the "Take lead" action check active restriction and block with a clear message: "Open Pool access paused — access returns in Xh Ym active selling time." Existing leads / callbacks / send email / send quote all remain usable.
- Nightly cron ticks `active_hours_remaining` down using each agent's schedule and flips `status='ended'` + writes `restriction_ended` audit event when it hits 0.

## Phase 4 — Reporting extensions

- Add report cards to the existing admin analytics: phone clicks per agent, unique leads attempted, Spoken to vs Manager-confirmed Spoken to, confirmed mismatch rate, retry completion / missed rate, conversion rate after Spoken to (by agent + by lead source), avg time from lead claim to phone click, expired reservations, current + historical restrictions.
- Mismatch data restricted to managers/admins (never shown on public leaderboards).

## What I will NOT touch in this pass (unless you ask)

- The Open Pool reservation timer values, the 15-minute retry logic, and the Quick Log outcome UI — those already exist and were adjusted in the previous turns. I'll only *instrument* them, not restructure them. If Phases 2/3 reveal that the retry/reservation flow needs backend changes to match the spec exactly, I'll flag that before touching it.

## Technical section

- Migrations create tables + GRANTS + RLS + `has_role` checks per project standards.
- No PII in logs; phone numbers already stored on leads so we're not introducing new sensitive data.
- Edge function uses `SUPABASE_SERVICE_ROLE_KEY` internally; frontend only reads/inserts events under RLS.
- Restriction "active hours" math uses `agent_schedules` (already in project) + a per-agent counter that decrements via a scheduled `pg_cron` job every 15 min during working hours.

---

**Shall I proceed with Phase 1 (Phone Logs page + phone event tracking) now?** Once that's live and you can see events flowing in, I'll move to Phase 2 (manager verification) and Phase 3 (automatic restrictions).