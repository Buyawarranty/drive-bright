CREATE OR REPLACE FUNCTION public.get_clean_leads_per_agent(
  _agent_ids uuid[],
  _start timestamptz,
  _end timestamptz
)
RETURNS TABLE(assigned_to uuid, clean_leads bigint, clean_converted bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sl.assigned_to,
         COUNT(*)::bigint AS clean_leads,
         COUNT(*) FILTER (WHERE sl.is_paid = true OR sl.status = 'converted')::bigint AS clean_converted
  FROM public.sales_leads sl
  WHERE sl.assigned_to = ANY(_agent_ids)
    AND sl.created_at >= _start
    AND sl.created_at <= _end
    AND sl.status NOT IN ('fake_lead', 'wrong_number', 'do_not_contact')
  GROUP BY sl.assigned_to;
$$;

GRANT EXECUTE ON FUNCTION public.get_clean_leads_per_agent(uuid[], timestamptz, timestamptz) TO authenticated;