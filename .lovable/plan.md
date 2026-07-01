# CallRail Admin Integration — Build Plan

Bring CallRail calls into the admin so the agent CallRail assigned the tracking number to sees a big incoming-call banner in real time and a persistent missed-call bar they must acknowledge.

## 1. Database (single migration)

Two new tables in `public`:

**`callrail_tracking_numbers`**
- `callrail_tracker_id text unique`, `phone_e164`, `label`
- `assigned_admin_user_id uuid` → `admin_users.id`
- `active bool default true`, timestamps

**`callrail_calls`**
- `callrail_call_id text unique`
- `direction`, `status` (`ringing`|`in_progress`|`completed`|`missed`|`voicemail`)
- `caller_number`, `caller_name`, `caller_city`, `tracker_id`, `tracked_number`
- `assigned_admin_user_id uuid` (resolved from tracker)
- `matched_lead_id`, `matched_customer_id` (phone match against `sales_leads` / `customers`)
- `started_at`, `answered_at`, `ended_at`, `duration_seconds`, `recording_url`, `raw jsonb`
- `acknowledged_at`, `acknowledged_by`, `callback_lead_id`

RLS:
- Sales agents: rows where `assigned_admin_user_id = current admin_users.id` OR NULL
- Admin / super_admin / performance_manager / sales_manager: all rows
- GRANTs to `authenticated` + `service_role` per project rules

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.callrail_calls;`

## 2. Edge functions

**`callrail-webhook`** (public, HMAC-verified via `CALLRAIL_WEBHOOK_SECRET`)
- Handles Pre-Call (ringing) / Post-Call (completed|missed|voicemail) / Call-Modified
- Upserts by `callrail_call_id`, transitions status
- Resolves `assigned_admin_user_id` from tracker
- Phone-matches (last 9 digits, strip UK `44`/`0`) against `sales_leads.phone` + `customers.phone`
- On answered completed call with a lead match → writes to `lead_call_logs`
- Leaves `acknowledged_at` NULL on missed/voicemail

**`callrail-sync-numbers`** (admin-invoked)
- Uses `CALLRAIL_API_KEY` + `CALLRAIL_ACCOUNT_ID` to pull tracker list and upsert `callrail_tracking_numbers`

## 3. Realtime hook + UI (always mounted in admin shell)

**`src/hooks/useCallRailPresence.ts`**
- Subscribes to `postgres_changes` on `callrail_calls` filtered by current admin id (+ unassigned)
- Cleanup with `supabase.removeChannel` per project realtime rules
- Returns `activeIncomingCall` and `missedCalls`

**`src/components/admin/calls/IncomingCallBanner.tsx`**
- Full-width fixed banner, high-contrast blue/orange, ring animation
- Caller number, matched lead/customer link, tracker label
- Plays `/sounds/ringtone.mp3`, fires `Notification` if permitted
- Actions: Open lead · Answered · Mark missed

**`src/components/admin/calls/MissedCallBanner.tsx`**
- Sticky red bar beneath incoming banner
- Up to 3 unacknowledged missed calls
- Call back (tel: + creates `lead_reminders` callback) · Dismiss (sets `acknowledged_at`)

**Integration**
- Mount both in the admin layout alongside `MaintenanceBanner`
- Add a "Missed calls" section/counter to `NotificationBell`
- Request `Notification.requestPermission()` on first admin load

## 4. Admin management screen

New route `Dealer Admin → Call Tracking` (`src/pages/dealer-admin/DealerAdminCallTracking.tsx`):
- Tracking numbers table with inline assign-to-agent dropdown (from `admin_users`)
- Recent calls table (filter by agent / status / date) with recording playback, matched-lead link, manual re-assign
- "Sync from CallRail" button → `callrail-sync-numbers`

## 5. Secrets (requested after approval)

- `CALLRAIL_WEBHOOK_SECRET` — signing secret entered in CallRail webhook settings
- `CALLRAIL_API_KEY` — CallRail Account API token
- `CALLRAIL_ACCOUNT_ID`

## 6. Assets

- Add `public/sounds/ringtone.mp3` (short royalty-free ringtone; I'll add a placeholder file and note where to swap)

## User setup after deploy

1. In CallRail: add company-level webhooks (Pre-Call, Post-Call, Call-Modified) → deployed function URL with the shared secret
2. In admin → Call Tracking: click "Sync from CallRail", then assign each tracking number to the correct agent

## Out of scope (v1)

- Click-to-dial through CallRail (keep `tel:` + existing Zoiper)
- Whisper/coaching, SMS
- Dynamic agent-status → CallRail routing (v1 is static per tracker)

---

**Ready to build?** On approval I'll: run the migration → request the 3 secrets → deploy both edge functions → add the hook, banners, admin route, and wire them into the admin shell.
