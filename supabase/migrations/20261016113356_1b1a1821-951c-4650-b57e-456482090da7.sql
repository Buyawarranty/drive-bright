REVOKE EXECUTE ON FUNCTION public.can_view_lead_count(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_lead_count_report(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_lead_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_count_report(date, date) TO authenticated;