# WhatsApp (WATI) sales inbox in the CRM

A new **WhatsApp Leads** area where inbound WhatsApp enquiries land instantly, the hottest customers sit at the top, an agent clicks **Take Lead**, and the whole conversation is chatted, quoted and closed inside the CRM. The CRM owns who the lead belongs to; WATI only carries the messages.

## What sales agents will see

**WhatsApp Leads (new sidebar tab)**

- Two lists: **Available leads** (unclaimed, shared) and **My WhatsApp leads**.
- Each card shows: customer name, phone number, latest message, time of that message, unread count, lead source, lead status, assigned agent and a heat badge (🔥 Hot / 🟠 Warm / ⚪ Normal).
- Hot first, then warm, then normal, newest reply on top. New messages appear without refreshing.
- **Take Lead** on any available card. First click wins; it disappears from everyone else's available list straight away and cannot be double-claimed. Who claimed it and when is recorded.
- Opening a lead shows the full WhatsApp conversation with a reply box. Customer messages on the left, our messages on the right with the agent's name, plus sent / delivered / read ticks where WATI reports them.
- Status buttons: New Lead → Contacted → Quote Sent → Hot Opportunity → Follow-Up → Won → Lost. Every change is logged with who and when.
- **Next follow-up** date and time per lead. Overdue follow-ups are pinned to the top in red. If the customer replies, the lead jumps back to the top of the agent's inbox and the unread count returns.

**Hot lead alert**

- When an unclaimed hot lead arrives, every sales agent on shift gets a red card in the existing left-hand alert rail: "🔥 Hot WhatsApp Lead - Customer is asking for a quote", with the customer name, the message, **Take Lead** and **Open chat**. It clears for everyone once someone claims it.

## Hot lead scoring

Each inbound message is scored on wording: asking a price or quote, how to buy, cover or warranty options, payment or instalments, sending a registration or vehicle details, "yes please / let's do it / I want to proceed", or a positive reply to our last sales message → **Hot**. Softer interest (general questions about cover, "how does it work", "thinking about it") → **Warm**. Everything else → **Normal**. Score is recalculated on each new message and only ever moves up while the lead is open.

## Managers

New **WhatsApp dashboard** panel (management only) showing: unassigned leads, hot leads waiting, leads per agent, average first-response time, conversations handled, quotes sent, deals won, conversion rate by agent, and a "not replied to" list. Managers can reassign any WhatsApp lead to another agent from there, and every reassignment is written to the existing assignment audit trail.

## Matching and no duplicates

A customer is matched on their WhatsApp number (last 9 digits, same rule the CRM already uses) against existing leads and customer records. A match updates that record and appends the message; no match creates one new lead. A returning customer never creates a second lead, and a lead already owned by an agent stays with that agent.

## WATI connection

WATI needs an API endpoint and access token from your WATI account. Everything will be built and usable now, with the WhatsApp connection switched off until those details are added; once added, inbound and outbound messages start flowing with no further work. You will also paste one webhook address into WATI so incoming messages reach the CRM.

## Technical detail

**Database (migration)**

- `whatsapp_conversations` - one row per WhatsApp number: `wati_contact_id`, `phone`, `phone_normalized` (unique), `display_name`, `lead_id`, `customer_id`, `assigned_to`, `claimed_by`, `claimed_at`, `heat` (`hot|warm|normal`), `heat_reason`, `pipeline_status` (`new_lead|contacted|quote_sent|hot_opportunity|follow_up|won|lost`), `unread_count`, `last_message_at`, `last_message_preview`, `last_direction`, `last_agent_reply_at`, `first_response_seconds`, `next_follow_up_at`, `lead_source`, `is_open`.
- `whatsapp_messages` - `conversation_id`, `wati_message_id` (unique), `direction`, `body`, `media_url`, `media_type`, `status` (`sent|delivered|read|failed`), `sent_by_admin_id`, `wati_timestamp`, `raw` jsonb.
- `whatsapp_status_events` - pipeline/assignment audit: `conversation_id`, `from_status`, `to_status`, `from_assigned_to`, `to_assigned_to`, `changed_by`, `note`.
- `claim_whatsapp_conversation(_conversation_id, _agent_id)` security-definer function: `UPDATE ... WHERE assigned_to IS NULL` returning the row, so two simultaneous clicks cannot both win; also stamps `assigned_to` on the linked `sales_leads` row and writes `lead_assignment_audit` + `whatsapp_status_events`.
- Both message tables added to `supabase_realtime`; RLS: sales roles read all conversations and their own messages/replies, management full access, `service_role` all. GRANTs for `authenticated` and `service_role` in the same migration.
- `sales_leads` gains `whatsapp_conversation_id` and reuses `lead_source = 'other'` with a `WhatsApp` tag in `lead_tags`/`lead_tag_assignments`.

**Edge functions**

- `wati-webhook` (`verify_jwt = false`) - receives WATI inbound message / message-status events, verifies a shared `WATI_WEBHOOK_SECRET`, upserts conversation by `phone_normalized`, inserts the message idempotently on `wati_message_id`, runs the scorer, bumps `unread_count` / `last_message_at`, creates or links the `sales_leads` row via the existing tail-9 matching helpers, and re-opens follow-ups.
- `wati-send-message` (JWT verified in code) - validates the caller is the owning agent or management, posts to WATI's send-message endpoint, and stores the outbound row with the returned message id.
- Shared `_shared/whatsappHeat.ts` scorer used by the webhook so admin and server agree on the badge.
- Secrets required later: `WATI_API_ENDPOINT`, `WATI_ACCESS_TOKEN`, `WATI_WEBHOOK_SECRET`.

**Frontend**

- `src/components/admin/whatsapp/WhatsAppLeadsTab.tsx`, `WhatsAppLeadCard.tsx`, `WhatsAppConversationPanel.tsx`, `WhatsAppPipelineBar.tsx`, `WhatsAppManagerDashboard.tsx`.
- `src/hooks/useWhatsAppConversations.ts` (realtime list + optimistic claim), `useWhatsAppMessages.ts`, `useWhatsAppHotAlerts.ts`.
- `src/lib/whatsappHeat.ts` (shared labels/colours), `src/lib/whatsappPipeline.ts` (status order and labels).
- New `whatsapp-leads` tab registered in `AdminSidebar.tsx` for sales, sales_lead, sales_manager, admin, super_admin; hot alert rendered through `AlertRailSlot` with a new order constant so it stacks with existing alerts and never overlaps.
- Existing rules respected: sales roles still never see lead source detail where they are already blocked, one alert beep per session via `alertSoundBudget`, and worked/owned leads are never reassigned by automation.
