CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wati_contact_id text,
  phone text NOT NULL,
  phone_normalized text NOT NULL UNIQUE,
  display_name text,
  lead_id uuid,
  customer_id uuid,
  assigned_to uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  claimed_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  heat text NOT NULL DEFAULT 'normal',
  heat_reason text,
  pipeline_status text NOT NULL DEFAULT 'new_lead',
  unread_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  last_message_preview text,
  last_direction text,
  last_agent_reply_at timestamptz,
  first_response_seconds integer,
  next_follow_up_at timestamptz,
  lead_source text DEFAULT 'whatsapp',
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  wati_message_id text UNIQUE,
  direction text NOT NULL,
  body text,
  media_url text,
  media_type text,
  status text,
  sent_by_admin_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  wati_timestamp timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.whatsapp_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  from_status text,
  to_status text,
  from_assigned_to uuid,
  to_assigned_to uuid,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS whatsapp_conversation_id uuid;

CREATE INDEX idx_wa_conv_assigned ON public.whatsapp_conversations(assigned_to);
CREATE INDEX idx_wa_conv_last_msg ON public.whatsapp_conversations(last_message_at DESC);
CREATE INDEX idx_wa_conv_heat ON public.whatsapp_conversations(heat);
CREATE INDEX idx_wa_msg_conv ON public.whatsapp_messages(conversation_id, created_at);
CREATE INDEX idx_wa_status_conv ON public.whatsapp_status_events(conversation_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
GRANT SELECT, INSERT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
GRANT SELECT, INSERT ON public.whatsapp_status_events TO authenticated;
GRANT ALL ON public.whatsapp_status_events TO service_role;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read wa conversations" ON public.whatsapp_conversations
  FOR SELECT TO authenticated
  USING (public.current_admin_user_id() IS NOT NULL);

CREATE POLICY "staff update own or managed wa conversations" ON public.whatsapp_conversations
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_lead_routing((select auth.uid()))
    OR assigned_to = public.current_admin_user_id()
  )
  WITH CHECK (
    public.can_manage_lead_routing((select auth.uid()))
    OR assigned_to = public.current_admin_user_id()
  );

CREATE POLICY "staff read wa messages" ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (public.current_admin_user_id() IS NOT NULL);

CREATE POLICY "staff insert wa messages" ON public.whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.current_admin_user_id() IS NOT NULL);

CREATE POLICY "staff read wa status events" ON public.whatsapp_status_events
  FOR SELECT TO authenticated
  USING (public.current_admin_user_id() IS NOT NULL);

CREATE POLICY "staff insert wa status events" ON public.whatsapp_status_events
  FOR INSERT TO authenticated
  WITH CHECK (public.current_admin_user_id() IS NOT NULL);

CREATE TRIGGER trg_wa_conv_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_whatsapp_conversation(_conversation_id uuid, _agent_id uuid)
RETURNS public.whatsapp_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.whatsapp_conversations;
BEGIN
  UPDATE public.whatsapp_conversations
     SET assigned_to = _agent_id,
         claimed_by = _agent_id,
         claimed_at = now(),
         pipeline_status = CASE WHEN pipeline_status = 'new_lead' THEN 'new_lead' ELSE pipeline_status END
   WHERE id = _conversation_id
     AND assigned_to IS NULL
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_row.lead_id IS NOT NULL THEN
    UPDATE public.sales_leads
       SET assigned_to = _agent_id,
           assigned_at = now()
     WHERE id = v_row.lead_id
       AND (assigned_to IS NULL OR assigned_to = _agent_id);
  END IF;

  INSERT INTO public.whatsapp_status_events (conversation_id, to_assigned_to, changed_by, note)
  VALUES (_conversation_id, _agent_id, _agent_id, 'Lead claimed from WhatsApp available queue');

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reassign_whatsapp_conversation(_conversation_id uuid, _agent_id uuid)
RETURNS public.whatsapp_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.whatsapp_conversations;
  v_prev uuid;
  v_actor uuid;
BEGIN
  IF NOT public.can_manage_lead_routing(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised to reassign WhatsApp leads';
  END IF;

  v_actor := public.current_admin_user_id();

  SELECT assigned_to INTO v_prev FROM public.whatsapp_conversations WHERE id = _conversation_id;

  UPDATE public.whatsapp_conversations
     SET assigned_to = _agent_id,
         claimed_by = COALESCE(claimed_by, _agent_id),
         claimed_at = COALESCE(claimed_at, now())
   WHERE id = _conversation_id
  RETURNING * INTO v_row;

  IF v_row.lead_id IS NOT NULL THEN
    UPDATE public.sales_leads
       SET assigned_to = _agent_id, assigned_at = now()
     WHERE id = v_row.lead_id;
  END IF;

  INSERT INTO public.whatsapp_status_events (conversation_id, from_assigned_to, to_assigned_to, changed_by, note)
  VALUES (_conversation_id, v_prev, _agent_id, v_actor, 'Manager reassignment');

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_whatsapp_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_whatsapp_conversation(uuid, uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;