CREATE OR REPLACE FUNCTION private.get_lead_quality_report(p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '15s'
AS $$ DECLARE result jsonb; BEGIN
 IF NOT COALESCE(public.can_view_lead_count((SELECT auth.uid())),false) THEN RAISE EXCEPTION 'Not authorised to view lead count'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 1100 THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 WITH base AS MATERIALIZED (
 SELECT sl.*, CASE WHEN lead_source='google_ad' THEN 'google' WHEN lead_source='social_ad' THEN 'facebook' WHEN lead_source IS NULL OR lead_source='website' THEN 'organic' ELSE 'other' END AS source_group FROM public.sales_leads sl
 WHERE (created_at >= (p_from::timestamp AT TIME ZONE 'Europe/London') AND created_at < ((p_to+1)::timestamp AT TIME ZONE 'Europe/London')) OR (last_resubmitted_at >= (p_from::timestamp AT TIME ZONE 'Europe/London') AND last_resubmitted_at < ((p_to+1)::timestamp AT TIME ZONE 'Europe/London'))
 ), status_counts AS (SELECT source_group,status::text AS status_key,count(*) AS n FROM base GROUP BY source_group,status), statuses AS (SELECT source_group,jsonb_object_agg(status_key,n) AS counts FROM status_counts GROUP BY source_group), groups AS (
 SELECT source_group,count(*) AS total,jsonb_build_object(
 'callbacks',count(*) FILTER (WHERE is_callback IS TRUE),
 'paid',count(*) FILTER (WHERE is_paid IS TRUE),
 'awaiting',count(*) FILTER (WHERE assigned_to IS NULL),
 'hot',count(*) FILTER (WHERE priority IN ('high','urgent') AND status NOT IN ('lost','fake_lead','not_eligible','unsubscribed','archived')),
 'repeat',count(*) FILTER (WHERE last_resubmitted_at >= (p_from::timestamp AT TIME ZONE 'Europe/London') AND last_resubmitted_at < ((p_to+1)::timestamp AT TIME ZONE 'Europe/London')),
 'reminders',count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.lead_reminders lr WHERE lr.lead_id=base.id::text AND lr.status IN ('pending','snoozed'))),
 'checkout_struggle',count(*) FILTER (WHERE status NOT IN ('archived','fake_lead','lost','not_interested') AND EXISTS (
 SELECT 1 FROM public.checkout_struggle_alerts ca WHERE ca.created_at >= now()-interval '24 hours' AND (
 (nullif(btrim(base.email),'') IS NOT NULL AND lower(btrim(ca.customer_email))=lower(btrim(base.email))) OR
 (nullif(regexp_replace(coalesce(base.phone,''),'\D','','g'),'') IS NOT NULL AND regexp_replace(regexp_replace(coalesce(ca.customer_phone,''),'\D','','g'),'^44','0')=regexp_replace(regexp_replace(base.phone,'\D','','g'),'^44','0')) OR
 (nullif(regexp_replace(coalesce(base.vehicle_reg,''),'\s','','g'),'') IS NOT NULL AND upper(regexp_replace(ca.vehicle_reg,'\s','','g'))=upper(regexp_replace(base.vehicle_reg,'\s','','g')))
 )))
 ) AS activities FROM base GROUP BY source_group)
 SELECT jsonb_build_object('as_of',now(),'rows',COALESCE(jsonb_agg(jsonb_build_object('source',g.source_group,'total',g.total,'statuses',s.counts,'activities',g.activities) ORDER BY g.source_group),'[]'::jsonb)) INTO result FROM groups g JOIN statuses s USING(source_group);
 RETURN result; END; $$;
DO $$ DECLARE caller uuid; report jsonb; actual bigint; expected bigint; blocked boolean := false; BEGIN
 SELECT user_id INTO caller FROM public.admin_users WHERE role='super_admin' AND is_active=true LIMIT 1;
 IF caller IS NULL THEN RAISE EXCEPTION 'No eligible test caller'; END IF;
 PERFORM set_config('request.jwt.claim.sub',caller::text,true);
 report := public.get_lead_quality_report('2026-10-01','2026-10-17');
 SELECT COALESCE(sum((r->>'total')::bigint),0) INTO actual FROM jsonb_array_elements(report->'rows') r;
 SELECT count(*) INTO expected FROM public.sales_leads WHERE (created_at >= ('2026-10-01'::timestamp AT TIME ZONE 'Europe/London') AND created_at < ('2026-10-18'::timestamp AT TIME ZONE 'Europe/London')) OR (last_resubmitted_at >= ('2026-10-01'::timestamp AT TIME ZONE 'Europe/London') AND last_resubmitted_at < ('2026-10-18'::timestamp AT TIME ZONE 'Europe/London'));
 IF actual <> expected THEN RAISE EXCEPTION 'Quality total does not match cohort'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM public.get_lead_quality_report('2026-10-01','2026-10-17'); EXCEPTION WHEN raise_exception THEN blocked := true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unsigned caller was not blocked'; END IF;
END; $$;