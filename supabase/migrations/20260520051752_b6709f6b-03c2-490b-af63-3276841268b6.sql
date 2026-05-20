
CREATE OR REPLACE FUNCTION public.get_mtd_leads_per_agent(_agent_ids uuid[])
RETURNS TABLE(assigned_to uuid, lead_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sl.assigned_to, COUNT(*)::bigint
  FROM sales_leads sl
  WHERE sl.assigned_to = ANY(_agent_ids)
    AND sl.created_at >= date_trunc('month', now())
    AND sl.created_at <= now()
    AND EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  GROUP BY sl.assigned_to;
$$;

GRANT EXECUTE ON FUNCTION public.get_mtd_leads_per_agent(uuid[]) TO authenticated;
