# Unified Customer Email Log in Emails Tab

Right now `email_logs` is only written by ~10 of the 44 edge functions that actually send mail through Resend. The rest (welcome, policy docs, customer credentials, abandoned cart, Trustpilot, claims comms, contact replies, etc.) send silently with no central record. That's why the Emails tab can't show "all emails sent to customers".

This plan unifies all customer-bound sends into a single log, surfaces them in the Emails tab with full filtering and export, and opens the tab to admins, super admins and lead_gen.

## What gets built

### 1. Central logging helper (one place, one shape)
- New `supabase/functions/_shared/log-email.ts` exporting `logCustomerEmail({ recipient_email, subject, template_name, status, error_message, metadata, customer_id?, policy_number?, registration_plate?, source_function })`.
- Writes to existing `email_logs` table (extending `metadata` JSONB with `source_function`, `registration_plate`, `policy_number`, `customer_name`).
- Always writes, even on failure (status = `failed` + `error_message`), so admins can see attempted sends.

### 2. Retrofit every customer-facing Resend send
Wrap the Resend call in each of these to log via the helper. Internal admin-only mails (admin invites, credential change notices, password resets for staff) are excluded since the user asked for **customer** emails.

Customer-facing functions to instrument:
- send-welcome-email, send-welcome-email-manual, send-welcome-email-alternate
- send-policy-documents (already partial — normalize)
- send-customer-credentials, resend-customer-credentials
- send-quote-email, send-admin-quote, send-step4-instant-email
- send-abandoned-cart-email, send-discount-email, send-return-discount-reminder
- send-trustpilot-review-request, send-trustpilot-review-emails
- send-invoice-email, send-warranty-upgrade-notification
- send-referral-email, send-bulk-reminder-emails
- send-claim-info-email, send-claim-email, send-claim-update-request, submit-claim, submit-claim-evidence, submit-claim-update
- submit-contact, submit-complaint, submit-cancellation, flag-quote-details
- handle-successful-payment, process-payment-assist-success (purchase confirmations)
- forward-contact-email, forward-claim-email (when recipient is a customer)
- send-sale-notification, send-agent-sale-notification — only if recipient is the customer

### 3. Emails tab — new "Customer Emails" view
Add a dedicated sub-tab in `UnifiedEmailHub` (separate from the existing template/campaign logs) showing the unified feed:
- **Columns**: Sent at, Recipient, Customer name, Reg plate, Template / source, Subject, Status badge, Error (if any), Actions.
- **Filters**: date range (preset + custom), status (sent / failed / bounced / pending), template/source dropdown, free-text search on email / subject / reg plate / customer name.
- **Stats strip**: total / sent / failed / bounced for the active filter.
- **Pagination**: 50 per page, newest first.
- **Row actions**: View full metadata (modal with raw JSON), Resend (for failed) where supported.
- **CSV export**: exports the currently-filtered set with all columns including metadata fields (matching the pattern used for the new GCLID export).

### 4. Access control
- RLS on `email_logs`: allow SELECT for `admin`, `super_admin`, `lead_gen` (via `has_role`). Keep INSERT restricted to service_role (edge functions already use it).
- Route guard in `AdminDashboard.tsx` for `tab=emails`: allow `admin`, `super_admin`, `lead_gen`; show access-denied card otherwise.
- Sidebar entry visible for the same three roles.

### 5. Verification
- Trigger one of each major email type from staging (welcome, policy docs, abandoned cart, contact reply) and confirm a row appears in the new view with correct metadata.
- Confirm a lead_gen user can open the tab; confirm a sales agent cannot.

## Technical notes

- No schema migration needed beyond the RLS policy update — `email_logs.metadata` is already JSONB so extra fields slot in.
- Helper imports the service-role client; idempotent — safe to call after a failed Resend response.
- Edge function changes are mechanical; each gets `try { await resend.emails.send(...); await logCustomerEmail({ status: 'sent', ... }) } catch (e) { await logCustomerEmail({ status: 'failed', error_message: e.message, ... }); throw }`.
- Deduplication on `message_id` not used here (existing schema doesn't store it consistently); we treat each row as a distinct send attempt and surface `resend_count` for re-sends.

## Out of scope

- Marketing/bulk campaign analytics (already covered by existing Campaigns view).
- Auth/staff-only emails (admin invites, password resets) — not customer-facing.
- Migrating historical Resend sends from before this change — only new sends from rollout forward will appear.
