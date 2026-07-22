CREATE OR REPLACE FUNCTION public.get_lead_quick_note_counts(p_lead_ids uuid[])
RETURNS TABLE(lead_id uuid, note_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lead_id, COUNT(*)::bigint AS note_count
  FROM public.lead_quick_notes
  WHERE lead_id = ANY(p_lead_ids)
  GROUP BY lead_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_lead_quick_note_counts(uuid[]) TO authenticated;