## Call Stats — plan

New admin section that ingests call detail records (CDRs) from Zoiper via a webhook and displays per-agent dial / talk-time / missed-call stats, with the 08:00–19:00 Europe/London shift window highlighted and out-of-shift activity shown separately.

### What gets built

**1. Database (migration)**

- `zoiper_call_events` — one row per call.
  Columns: `id`, `external_call_id` (unique, for idempotent ingest), `agent_email`, `agent_extension`, `agent_user_id` (nullable FK-style to `admin_users.id`, resolved on insert), `direction` (`inbound`/`outbound`), `status` (`answered`/`missed`/`busy`/`no_answer`/`failed`/`cancelled`), `dialed_number`, `caller_number`, `started_at` (timestamptz), `answered_at`, `ended_at`, `duration_seconds`, `talk_seconds`, `raw_payload` (jsonb), `created_at`.
  Indexed on `(agent_user_id, started_at)` and `(started_at)`.
- `admin_users.sip_extension` — new nullable text column so we can map a Zoiper extension back to an admin user.
- `call_stats_access` — `(admin_user_id PK, granted_by, granted_at)`. Presence in the row grants access; management roles get access automatically without needing a row.
- Standard `GRANT`s (authenticated read for own + granted rows, service_role full) and RLS policies.

**2. Edge function `zoiper-cdr-webhook`**

- `POST` endpoint that Zoiper (or your PBX/SIP provider) calls per CDR.
- Auth: shared secret in `x-zoiper-secret` header, stored as `ZOIPER_WEBHOOK_SECRET`.
- Accepts JSON body with the fields above (flexible mapping — snake_case or camelCase).
- Resolves `agent_user_id` from `admin_users.sip_extension` (preferred) or `admin_users.email`.
- Upserts on `external_call_id` so retries are safe.
- Returns the resolved agent + parsed record for verification.

**3. Frontend — new admin tab "Call Stats"**

- `src/components/admin/CallStatsTab.tsx`
  - Date range picker (default: today, UK time).
  - Team filter: All / Blue / Red / any team (defaults to Blue + Red).
  - Table columns per agent:
    Agent · Team · Total dials · In-shift dials (8–7) · Missed · Answered · Avg call length · Total talk time · Longest call · Out-of-shift dials.
  - In-shift columns get the highlight styling; out-of-shift shown in a muted column so nothing is hidden.
  - Expandable row → last N calls with time / number / duration / status.
  - CSV export (uses existing `useDataExport`).
- Scope: pulls every user with a sales role (`sales`, `sales_lead`) plus anyone granted call-stats access, joined to their team via `lead_team_members` for the team column.

**4. Permissions sub-tab "User Access"**

- `src/components/admin/CallStatsPermissionsTab.tsx`
  - Lists all `admin_users`; toggle grants/revokes `call_stats_access`.
  - Only super_admin + admin + sales_manager + performance_manager can open this sub-tab.
  - Default (no explicit grants needed) is: super_admin, admin, sales_manager, performance_manager. Everyone else needs an explicit grant.

**5. Nav wiring**

- Add `call-stats` to the admin dashboard tab list with `Phone` icon, visible only if the viewer passes the access check above.

### Access model

| Role                    | Sees Call Stats tab | Can grant access |
| ----------------------- | ------------------- | ---------------- |
| super_admin, admin      | Yes                 | Yes              |
| sales_manager, perf_mgr | Yes                 | Yes              |
| Any other role          | Only if granted     | No               |

### Zoiper side (you configure once)

Zoiper Biz / your SIP PBX needs to POST each completed call to:

```text
https://mzlpuxzwyrcyrgrongeb.functions.supabase.co/zoiper-cdr-webhook
Header: x-zoiper-secret: <secret you set>
Body (JSON):
{
  "external_call_id": "abc-123",
  "agent_extension": "201",         // or "agent_email"
  "direction": "outbound",
  "status": "answered",             // answered | missed | busy | no_answer | failed
  "dialed_number": "+441234...",
  "caller_number": "+441234...",
  "started_at": "2026-07-14T08:15:00Z",
  "answered_at": "2026-07-14T08:15:07Z",
  "ended_at": "2026-07-14T08:19:30Z",
  "duration_seconds": 270,
  "talk_seconds": 263
}
```

I'll ask for `ZOIPER_WEBHOOK_SECRET` at the point of deploying the function so it's ready to paste into Zoiper.

### Not in scope for this pass

- Any automatic pull from Zoiper's client — Zoiper the softphone has no cloud API, so ingest is push-only via the webhook above.
- Staff-facing (agent self-serve) view — will be added after you've verified numbers, per your note.

Approve and I'll build it end to end (migration → function → UI → nav → permissions tab).