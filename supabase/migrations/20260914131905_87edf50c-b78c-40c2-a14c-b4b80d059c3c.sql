CREATE OR REPLACE FUNCTION public.can_view_chatbot_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id
      AND is_active = true
      AND (
        role IN ('admin','super_admin','sales_manager')
        OR COALESCE((permissions->>'tab_chatbot-data')::boolean, false) = true
      )
  );
$$;

DROP POLICY IF EXISTS "Management can read chat insights" ON public.ai_chat_events;
CREATE POLICY "Chatbot data viewers can read chat insights"
ON public.ai_chat_events FOR SELECT TO authenticated
USING (public.can_view_chatbot_data((SELECT auth.uid())));

DROP POLICY IF EXISTS "Management view all sandbox threads" ON public.ai_sandbox_threads;
CREATE POLICY "Chatbot data viewers view all sandbox threads"
ON public.ai_sandbox_threads FOR SELECT TO authenticated
USING (public.can_view_chatbot_data((SELECT auth.uid())));

DROP POLICY IF EXISTS "Management view all sandbox messages" ON public.ai_sandbox_messages;
CREATE POLICY "Chatbot data viewers view all sandbox messages"
ON public.ai_sandbox_messages FOR SELECT TO authenticated
USING (public.can_view_chatbot_data((SELECT auth.uid())));

DROP POLICY IF EXISTS "Management manage chatbot answer library" ON public.ai_chat_answer_library;
CREATE POLICY "Chatbot data viewers read answer library"
ON public.ai_chat_answer_library FOR SELECT TO authenticated
USING (public.can_view_chatbot_data((SELECT auth.uid())));
CREATE POLICY "Management manage chatbot answer library"
ON public.ai_chat_answer_library FOR ALL TO authenticated
USING (is_management((SELECT auth.uid())) OR is_super_admin())
WITH CHECK (is_management((SELECT auth.uid())) OR is_super_admin());