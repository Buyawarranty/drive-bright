---
name: WhatsApp (WATI) leads inbox
description: WhatsApp Leads CRM tab, hot-lead scoring, Take Lead claiming, pipeline and manager dashboard backed by WATI
type: feature
---
- CRM owns lead ownership; WATI only carries messages. Tables: `whatsapp_conversations` (one row per `phone_normalized`, unique), `whatsapp_messages` (`wati_message_id` unique = idempotency), `whatsapp_status_events` (pipeline + ownership audit). `sales_leads.whatsapp_conversation_id` links back.
- Edge functions: `wati-webhook` (verify_jwt = false, optional `WATI_WEBHOOK_SECRET` via `x-wati-secret` header or `?secret=`), `wati-send-message` (JWT checked in code; only the owning agent or `can_manage_lead_routing` may reply).
- Secrets: `WATI_API_ENDPOINT`, `WATI_ACCESS_TOKEN`, `WATI_WEBHOOK_SECRET`. Sending returns 503 `wati_not_configured` until set.
- Claiming goes through `claim_whatsapp_conversation(_conversation_id, _agent_id)` — `UPDATE ... WHERE assigned_to IS NULL`, so a second simultaneous click gets `already_taken`. Manager reassign uses `reassign_whatsapp_conversation`.
- Heat scorer lives in BOTH `supabase/functions/_shared/whatsappHeat.ts` and `src/lib/whatsappHeat.ts` — keep them in sync. Heat only ever moves up while a conversation is open.
- Pipeline: new_lead → contacted → quote_sent → hot_opportunity → follow_up → won → lost (`src/lib/whatsappPipeline.ts`). `won`/`lost` set `is_open = false`.
- Never create a second lead for the same WhatsApp number: match on tail-9 via `find_sales_lead_by_phone_tail9`. New leads get the `WhatsApp` lead tag (#25D366).
- Hot unassigned leads alert through `AlertRailSlot` with `ALERT_RAIL_ORDER.whatsappHotLead = 15`.
- Inbound reply alerts appear on New Leads only for support@, the owning agent, or the agent whose outgoing message received the reply. Each unopened alert has a red border and a numbered red corner badge (1, 2, 3); opening the lead clears it.
