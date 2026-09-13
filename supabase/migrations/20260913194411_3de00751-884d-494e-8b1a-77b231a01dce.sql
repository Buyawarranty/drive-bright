-- Tighten WhatsApp tables from "any staff" to management only (can_manage_lead_routing)

DROP POLICY IF EXISTS "staff read wa conversations" ON public.whatsapp_conversations;
CREATE POLICY "management read wa conversations" ON public.whatsapp_conversations
FOR SELECT TO authenticated
USING (can_manage_lead_routing(auth.uid()));

DROP POLICY IF EXISTS "staff update own or managed wa conversations" ON public.whatsapp_conversations;
CREATE POLICY "management update wa conversations" ON public.whatsapp_conversations
FOR UPDATE TO authenticated
USING (can_manage_lead_routing(auth.uid()))
WITH CHECK (can_manage_lead_routing(auth.uid()));

DROP POLICY IF EXISTS "staff read wa messages" ON public.whatsapp_messages;
CREATE POLICY "management read wa messages" ON public.whatsapp_messages
FOR SELECT TO authenticated
USING (can_manage_lead_routing(auth.uid()));

DROP POLICY IF EXISTS "staff insert wa messages" ON public.whatsapp_messages;
CREATE POLICY "management insert wa messages" ON public.whatsapp_messages
FOR INSERT TO authenticated
WITH CHECK (can_manage_lead_routing(auth.uid()));

DROP POLICY IF EXISTS "staff read wa status events" ON public.whatsapp_status_events;
CREATE POLICY "management read wa status events" ON public.whatsapp_status_events
FOR SELECT TO authenticated
USING (can_manage_lead_routing(auth.uid()));

DROP POLICY IF EXISTS "staff insert wa status events" ON public.whatsapp_status_events;
CREATE POLICY "management insert wa status events" ON public.whatsapp_status_events
FOR INSERT TO authenticated
WITH CHECK (can_manage_lead_routing(auth.uid()));

DROP POLICY IF EXISTS "staff read wa tags" ON public.whatsapp_tags;
CREATE POLICY "management read wa tags" ON public.whatsapp_tags
FOR SELECT TO authenticated
USING (can_manage_lead_routing(auth.uid()));

DROP POLICY IF EXISTS "staff read wa conversation tags" ON public.whatsapp_conversation_tags;
CREATE POLICY "management read wa conversation tags" ON public.whatsapp_conversation_tags
FOR SELECT TO authenticated
USING (can_manage_lead_routing(auth.uid()));

DROP POLICY IF EXISTS "staff add wa conversation tags" ON public.whatsapp_conversation_tags;
CREATE POLICY "management add wa conversation tags" ON public.whatsapp_conversation_tags
FOR INSERT TO authenticated
WITH CHECK (can_manage_lead_routing(auth.uid()));

DROP POLICY IF EXISTS "staff remove wa conversation tags" ON public.whatsapp_conversation_tags;
CREATE POLICY "management remove wa conversation tags" ON public.whatsapp_conversation_tags
FOR DELETE TO authenticated
USING (can_manage_lead_routing(auth.uid()));