CREATE OR REPLACE FUNCTION public.can_manage_claim_reminders()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','sales_manager','performance_manager',
                   'claims_agent','claims_manager','accounts_manager','accounts',
                   'sales','sales_lead')
  );
$$;

DROP POLICY IF EXISTS "Staff can view claim reminders" ON public.claim_reminders;
DROP POLICY IF EXISTS "Staff can create claim reminders" ON public.claim_reminders;
DROP POLICY IF EXISTS "Staff can update claim reminders" ON public.claim_reminders;
DROP POLICY IF EXISTS "Staff can delete claim reminders" ON public.claim_reminders;

CREATE POLICY "Claims team can view claim reminders"
ON public.claim_reminders FOR SELECT TO authenticated
USING (public.can_manage_claim_reminders());

CREATE POLICY "Claims team can create claim reminders"
ON public.claim_reminders FOR INSERT TO authenticated
WITH CHECK (public.can_manage_claim_reminders());

CREATE POLICY "Claims team can update claim reminders"
ON public.claim_reminders FOR UPDATE TO authenticated
USING (public.can_manage_claim_reminders())
WITH CHECK (public.can_manage_claim_reminders());

CREATE POLICY "Claims team can delete claim reminders"
ON public.claim_reminders FOR DELETE TO authenticated
USING (public.can_manage_claim_reminders());