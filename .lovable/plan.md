## Goal

When an agent sends a quote from the admin dashboard, the agent (or admin) should automatically receive the **exact same branded quote email** the customer sees — no need to click "Send copy". The existing "Send copy to my email" CTA stays as a fallback for the rare case the auto-copy misses their inbox. Both emails should land in the primary inbox, not Spam or Promotions.

## Changes

### 1. `supabase/functions/send-admin-quote/index.ts`

Replace the current "[Internal] Quote sent — …" summary email (sent from `notifications@buyawarranty.co.uk`) with a second send of the **same branded HTML template** the customer receives.

- After the customer send succeeds, loop over `internalCopyRecipients` (which already includes `agentCopyEmail`, any `copyRecipients`, `cc`, `bcc`) and for each:
  - `from`: same `support@buyawarranty.co.uk` sender used for the customer (established reputation, DKIM/SPF/DMARC aligned).
  - `to`: `[copyEmail]` (one recipient per send — never CC/BCC, so each message has its own DKIM signature and unique headers).
  - `subject`: `[Your copy] ${safeSubject}` — distinct prefix so Gmail doesn't collapse it into the customer thread or mark it as a duplicate.
  - `html`: the same `brandedHtml` used for the customer (unchanged template).
  - `text`: same `plainText` alternative.
  - `reply_to`: the customer's email (`to`) so replying goes to the customer, not back to support.
  - `headers`: fresh `X-Entity-Ref-ID`, plus `X-BAW-Agent-Copy: true` and `X-BAW-Customer-Message-Id: <customer msg id>` for auditability. **Do not** set `Auto-Submitted: auto-generated` (that header is a Gmail Promotions/Bulk signal — the old code was setting it, which is one reason internal copies were landing in spam/promos).
  - `tags`: `template=admin_quote_agent_copy`, `source=admin_dashboard`.
- Keep the existing per-copy success/failure logging via `logCustomerEmail` (rename `template_name` to `admin_quote_agent_copy`, keep the same metadata fields).
- Delete the `copyFromHeader = notifications@…`, `copyHtml`, and `copyText` blocks — the branded template replaces them.

Deliverability notes baked into the change:
- Same sending domain and same reputation-warm mailbox (`support@`) for both messages.
- One recipient per send + unique `X-Entity-Ref-ID` avoids Gmail bulk-detection.
- No `List-Unsubscribe`, no `Auto-Submitted`, no `Precedence: bulk` — all Promotions/Spam triggers.
- Subject prefix `[Your copy]` keeps threading separate from the customer message.
- Plain-text alternative already present (helps spam scoring).

### 2. `src/components/admin/GetQuoteTab.tsx`

No wiring change needed for the automatic copy — `agentCopyEmail: adminEmail` is already passed at lines ~1014 and ~1346. The "Send copy to my email" button (around line 3595) also stays as-is; it remains the manual fallback and continues to invoke `send-admin-quote` with `to: adminEmail`.

Small copy tweak on the info line at ~3383: change

> ✉️ Sales copy will be included on the same email: {adminEmail}

to

> ✉️ You'll get the same quote email at: {adminEmail}

so agents understand what will arrive.

### 3. Deploy

After editing the edge function, deploy `send-admin-quote` so the change goes live for all agents and admins.

## Out of scope

- No DB schema changes.
- No changes to `send-quote-email` (public self-serve quote flow).
- No auth/permission changes — same `requireAdmin` gate covers all agents/admins.
- Inbox placement depends on the recipient's mail server; the changes above align the auto-copy with the customer email's already-good deliverability profile, but individual mailbox rules (e.g. an agent's own Gmail filter) are outside the code.
