CREATE OR REPLACE FUNCTION public.lead_has_been_worked(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.lead_has_human_activity(p_lead_id)
    OR EXISTS (
      SELECT 1 FROM public.sales_leads sl
      WHERE sl.id = p_lead_id
        AND (
          COALESCE(sl.manual_call_adjustment, 0) > 0
          OR sl.last_contacted_at IS NOT NULL
          OR COALESCE(btrim(sl.notes), '') <> ''
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.lead_has_been_worked(uuid) TO authenticated, service_role;