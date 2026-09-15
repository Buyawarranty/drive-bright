DROP POLICY IF EXISTS "Owners can view their sandbox handovers" ON public.ai_sandbox_handovers;
CREATE POLICY "Chatbot data viewers view handovers"
ON public.ai_sandbox_handovers FOR SELECT TO authenticated
USING (
  created_by = ( SELECT auth.uid() )
  OR public.can_view_chatbot_data(( SELECT auth.uid() ))
  OR is_management(( SELECT auth.uid() ))
  OR is_admin_or_sales(( SELECT auth.uid() ))
);

DROP POLICY IF EXISTS "Staff can update sandbox handovers" ON public.ai_sandbox_handovers;
CREATE POLICY "Staff can update sandbox handovers"
ON public.ai_sandbox_handovers FOR UPDATE TO authenticated
USING (
  created_by = ( SELECT auth.uid() )
  OR public.can_view_chatbot_data(( SELECT auth.uid() ))
  OR is_management(( SELECT auth.uid() ))
  OR is_admin_or_sales(( SELECT auth.uid() ))
);