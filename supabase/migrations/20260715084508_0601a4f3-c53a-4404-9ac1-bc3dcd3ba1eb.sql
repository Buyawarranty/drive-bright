
CREATE OR REPLACE FUNCTION public.release_stale_recontact_leads(_silence_days integer DEFAULT 60)
RETURNS TABLE(released_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _released int := 0;
  _cutoff timestamptz := now() - make_interval(days => _silence_days);
BEGIN
  WITH stale AS (
    SELECT sl.id, sl.assigned_to AS previous_owner
    FROM public.sales_leads sl
    WHERE sl.assigned_to IS NOT NULL
      AND sl.assigned_at IS NOT NULL
      AND sl.assigned_at < _cutoff
      AND sl.status NOT IN ('lost','fake_lead','converted','archived')
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_quick_notes lqn
        WHERE lqn.lead_id = sl.id AND lqn.created_at >= _cutoff
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_call_logs lcl
        WHERE lcl.lead_id = sl.id AND lcl.created_at >= _cutoff
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_activities la
        WHERE la.lead_id = sl.id AND la.created_at >= _cutoff
      )
    FOR UPDATE SKIP LOCKED
  ), released AS (
    UPDATE public.sales_leads sl
    SET assigned_to = NULL,
        assigned_at = NULL,
        updated_at = now()
    FROM stale s
    WHERE sl.id = s.id
    RETURNING sl.id, s.previous_owner
  ), audit AS (
    INSERT INTO public.lead_assignment_audit
      (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
    SELECT r.id, NULL, r.previous_owner, 'auto_release', 'auto_released_stale_' || _silence_days || 'd'
    FROM released r
    RETURNING 1
  )
  SELECT COUNT(*) INTO _released FROM released;

  RETURN QUERY SELECT _released;
END;
$function$;

-- Schedule nightly at 03:15 UTC. Unschedule any prior version first.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-stale-recontact-leads-nightly') THEN
    PERFORM cron.unschedule('release-stale-recontact-leads-nightly');
  END IF;
END $$;

SELECT cron.schedule(
  'release-stale-recontact-leads-nightly',
  '15 3 * * *',
  $$ SELECT public.release_stale_recontact_leads(60); $$
);
