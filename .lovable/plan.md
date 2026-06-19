## Goal
Give admins a clear log of every login-related event for a customer, shown directly inside the **Edit Customer Details** dialog (admin → Customers tab → Edit). Combines our own captured events with Supabase auth events.

## What gets logged

Captured by our own code (customer-facing flows + admin actions):
- **login_success** – customer signed in
- **login_failed** – wrong password / unknown email (with reason)
- **password_reset_requested** – customer used Forgot Password
- **credentials_resent** – Forgot Password "resend credentials" used
- **admin_password_reset** – admin triggered a password reset for the customer
- **admin_impersonate** – admin used "View as customer" / impersonation
- **admin_magic_link** – admin sent a magic / login link
- **admin_details_edited** – admin edited the customer's email/phone/name

Each row stores: email, customer_id (if known), event type, success flag, failure reason, IP address, user agent, who triggered it (admin id if admin-initiated), free-form metadata, timestamp.

Also merged into the timeline view: recent Supabase `auth.audit_log_entries` matching the customer's email (signups, password updates, token refreshes, email changes) — fetched server-side with the service role.

## UI placement

Inside `EditCustomerDetailsDialog`:
- Widen the dialog (`sm:max-w-2xl`).
- Keep existing form fields at the top.
- Add a new section beneath them: **"Recent login activity"** — collapsible, default open, scrollable list (last 50 events), newest first.
- Each row shows: icon + event label, timestamp ("2 mins ago" + full date on hover), email used, IP, device summary, and a coloured success / failure badge. Failure rows show the reason.
- A small "Refresh" button and an "Export CSV" button in the section header.

```text
┌─ Edit Customer Details ────────────────────────────┐
│ First name │ Surname │ Email │ Phone               │
│ [Save changes]                                     │
│                                                    │
│ ▼ Recent login activity        [Refresh] [Export]  │
│ ─────────────────────────────────────────────────  │
│ ✓ Login success   2m ago   1.2.3.4   Chrome/Mac   │
│ ✗ Login failed    5m ago   1.2.3.4   wrong pw     │
│ ✉ Password reset requested  1h ago                 │
│ 👤 Admin sent magic link    Yesterday  by Jane    │
│ … (scroll for more)                                │
└────────────────────────────────────────────────────┘
```

## Technical details

**Migration – new table `customer_login_attempts`**
- Columns: `id uuid pk`, `email text not null`, `customer_id uuid null`, `event_type text not null`, `success boolean not null default false`, `failure_reason text`, `ip_address text`, `user_agent text`, `triggered_by_admin_id uuid`, `metadata jsonb default '{}'`, `created_at timestamptz default now()`.
- Indexes on `lower(email)` and `customer_id`, plus `created_at desc`.
- GRANTs: `INSERT` to `anon` + `authenticated` (so login pages can write); `SELECT` to `authenticated`; `ALL` to `service_role`.
- RLS:
  - `INSERT` allowed to everyone (login page writes before auth completes).
  - `SELECT` only for admins/sales roles via existing `has_role` helper.

**Edge functions** (CORS, zod validation, `verify_jwt = false` for the public logger):
- `log-login-attempt` – public; accepts `{ email, event_type, success, failure_reason?, metadata? }`, captures IP + user-agent server-side, writes row. Rate-limited per IP (per existing pattern).
- `get-customer-login-history` – admin-only (verifies caller has admin/sales role via JWT); returns merged list of (a) `customer_login_attempts` rows for that email/customer_id and (b) recent `auth.audit_log_entries` rows joined to `auth.users.email`.

**Client wiring** (only the call sites — no UX change for customers):
- `src/pages/Auth.tsx` – after each `signInWithPassword`, fire `log-login-attempt` with success or failure reason.
- `src/pages/ForgotPassword.tsx` – on submit, log `credentials_resent`.
- Any existing admin "send password reset" / "impersonate" buttons in customer management – log `admin_password_reset` / `admin_impersonate`. (Will grep and wire each.)
- `EditCustomerDetailsDialog.tsx` – after a successful save, log `admin_details_edited` with a metadata diff of changed fields.

**New component**
- `src/components/admin/CustomerLoginActivity.tsx` – fetches via `get-customer-login-history`, renders the timeline, handles refresh + CSV export. Embedded inside `EditCustomerDetailsDialog`.

## Out of scope
- No changes to customer-facing UI or copy.
- No analytics dashboards / charts — just the per-customer timeline.
- No retention policy yet (rows kept indefinitely; can add a cron later if needed).