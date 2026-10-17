CREATE OR REPLACE FUNCTION public.get_lead_quality_report(p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '15s'
AS $$
DECLARE result jsonb;
BEGIN
 IF NOT COALESCE(public.can_view_lead_count((SELECT auth.uid())), false) THEN RAISE EXCEPTION 'Not authorised to view lead count'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 1100 THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 WITH base AS MATERIALIZED (
  SELECT sl.*, CASE WHEN lead_source = 'google_ad' THEN 'google' WHEN lead_source = 'social_ad' THEN 'facebook' WHEN lead_source IS NULL OR lead_source = 'website' THEN 'organic' ELSE 'other' END AS source_group
  FROM public.sales_leads sl
  WHERE (created_at >= (p_from::timestamp AT TIME ZONE 'Europe/London') AND created_at < ((p_to + 1)::timestamp AT TIME ZONE 'Europe/London'))
     OR (last_resubmitted_at >= (p_from::timestamp AT TIME ZONE 'Europe/London') AND last_resubmitted_at < ((p_to + 1)::timestamp AT TIME ZONE 'Europe/London'))
 ), status_counts AS (SELECT source_group, status::text AS status_key, count(*) AS n FROM base GROUP BY source_group, status),
 statuses AS (SELECT source_group, jsonb_object_agg(status_key,n) AS counts FROM status_counts GROUP BY source_group),
 groups AS (
  SELECT source_group, count(*) AS total,
   jsonb_build_object('callbacks',count(*) FILTER (WHERE is_callback IS TRUE),
    'paid',count(*) FILTER (WHERE is_paid IS TRUE),
    'awaiting',count(*) FILTER (WHERE assigned_to IS NULL),
    'hot',count(*) FILTER (WHERE priority IN ('high','urgent') AND status NOT IN ('lost','fake_lead','not_eligible','unsubscribed','archived')),
    'repeat',count(*) FILTER (WHERE last_resubmitted_at >= (p_from::timestamp AT TIME ZONE 'Europe/London') AND last_resubmitted_at < ((p_to + 1)::timestamp AT TIME ZONE 'Europe/London')),
    'reminders',count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.lead_reminders lr WHERE lr.lead_id = base.id::text AND lr.status IN ('pending','snoozed')))) AS activities
  FROM base GROUP BY source_group
 )
 SELECT jsonb_build_object('as_of',now(),'rows',COALESCE(jsonb_agg(jsonb_build_object('source',g.source_group,'total',g.total,'statuses',s.counts,'activities',g.activities) ORDER BY g.source_group),'[]'::jsonb)) INTO result
 FROM groups g JOIN statuses s USING (source_group);
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.get_lead_quality_report(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lead_quality_report(date,date) TO authenticated;