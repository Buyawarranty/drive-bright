CREATE TABLE public.whatsapp_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX whatsapp_tags_name_key ON public.whatsapp_tags (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_tags TO authenticated;
GRANT ALL ON public.whatsapp_tags TO service_role;
ALTER TABLE public.whatsapp_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read wa tags" ON public.whatsapp_tags
  FOR SELECT TO authenticated USING (current_admin_user_id() IS NOT NULL);
CREATE POLICY "managers manage wa tags" ON public.whatsapp_tags
  FOR ALL TO authenticated
  USING (can_manage_lead_routing((SELECT auth.uid())))
  WITH CHECK (can_manage_lead_routing((SELECT auth.uid())));

CREATE TABLE public.whatsapp_conversation_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.whatsapp_tags(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, tag_id)
);
CREATE INDEX whatsapp_conversation_tags_conv_idx ON public.whatsapp_conversation_tags (conversation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversation_tags TO authenticated;
GRANT ALL ON public.whatsapp_conversation_tags TO service_role;
ALTER TABLE public.whatsapp_conversation_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read wa conversation tags" ON public.whatsapp_conversation_tags
  FOR SELECT TO authenticated USING (current_admin_user_id() IS NOT NULL);
CREATE POLICY "staff add wa conversation tags" ON public.whatsapp_conversation_tags
  FOR INSERT TO authenticated WITH CHECK (current_admin_user_id() IS NOT NULL);
CREATE POLICY "staff remove wa conversation tags" ON public.whatsapp_conversation_tags
  FOR DELETE TO authenticated USING (current_admin_user_id() IS NOT NULL);

CREATE TRIGGER update_whatsapp_tags_updated_at
  BEFORE UPDATE ON public.whatsapp_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.whatsapp_tags (name, color, sort_order) VALUES
  ('Urgent', 'red', 10),
  ('Quote', 'orange', 20),
  ('Claim', 'blue', 30),
  ('Existing customer', 'green', 40),
  ('Renewal', 'teal', 50),
  ('Cancellation or refund', 'amber', 60),
  ('Complaint', 'rose', 70),
  ('General enquiry', 'slate', 80),
  ('Follow up', 'violet', 90),
  ('Not interested', 'zinc', 100);