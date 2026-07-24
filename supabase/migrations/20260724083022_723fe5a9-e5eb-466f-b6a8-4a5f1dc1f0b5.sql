
CREATE TABLE IF NOT EXISTS public.daily_lead_stats_snapshot (
  snapshot_date  date        NOT NULL,
  team_scope     text        NOT NULL DEFAULT 'all',
  counts         jsonb       NOT NULL,
  lead_count     integer     NOT NULL DEFAULT 0,
  snapshotted_at timestamptz NOT NULL DEFAULT now(),
  is_locked      boolean     NOT NULL DEFAULT true,
  PRIMARY KEY (snapshot_date, team_scope)
);

GRANT SELECT ON public.daily_lead_stats_snapshot TO authenticated;
GRANT ALL    ON public.daily_lead_stats_snapshot TO service_role;

ALTER TABLE public.daily_lead_stats_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read lead stats snapshots" ON public.daily_lead_stats_snapshot;
CREATE POLICY "Staff can read lead stats snapshots"
  ON public.daily_lead_stats_snapshot
  FOR SELECT TO authenticated
  USING (public.is_admin_or_sales(auth.uid()));

CREATE OR REPLACE FUNCTION public.snapshot_daily_lead_counts(
  p_date date,
  p_tz   text DEFAULT 'Europe/London'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start  timestamptz;
  v_end    timestamptz;
  v_counts jsonb;
  v_total  integer;
BEGIN
  v_start := (p_date::timestamp AT TIME ZONE p_tz);
  v_end   := ((p_date + 1)::timestamp AT TIME ZONE p_tz);

  WITH base AS (
    SELECT *
    FROM public.sales_leads
    WHERE (created_at >= v_start AND created_at < v_end)
       OR (last_resubmitted_at >= v_start AND last_resubmitted_at < v_end)
  )
  SELECT
    jsonb_build_object(
      'all_leads',        count(*),
      'live',             count(*) FILTER (WHERE status NOT IN ('lost','fake_lead','archived')),
      'new',              count(*) FILTER (WHERE status = 'new' AND COALESCE(resubmission_count, 0) = 0),
      'contacted',        count(*) FILTER (WHERE status = 'contacted'),
      'follow_up',        count(*) FILTER (WHERE status = 'follow_up'),
      'quote_sent',       count(*) FILTER (WHERE status = 'quote_sent'),
      'urgent_callback',  count(*) FILTER (WHERE status = 'urgent_callback'),
      'callbacks',        count(*) FILTER (WHERE is_callback = true),
      'paid',             count(*) FILTER (WHERE is_paid = true),
      'lost',             count(*) FILTER (WHERE status = 'lost'),
      'converted',        count(*) FILTER (WHERE status = 'converted'),
      'fake',             count(*) FILTER (WHERE status = 'fake_lead'),
      'no_answer',        count(*) FILTER (WHERE status = 'no_answer'),
      'left_voicemail',   count(*) FILTER (WHERE status = 'left_voicemail'),
      'wrong_number',     count(*) FILTER (WHERE status = 'wrong_number'),
      'callback_booked',  count(*) FILTER (WHERE status = 'callback_booked'),
      'bought_elsewhere', count(*) FILTER (WHERE status = 'bought_elsewhere'),
      'vehicle_sold',     count(*) FILTER (WHERE status = 'vehicle_sold'),
      'do_not_contact',   count(*) FILTER (WHERE status = 'do_not_contact'),
      'recovered',        count(*) FILTER (WHERE abandoned_cart_id IS NOT NULL AND assigned_at IS NULL AND step_two_completed_at IS NULL),
      'source_google',    count(*) FILTER (WHERE lead_source = 'google_ad'),
      'source_facebook',  count(*) FILTER (WHERE lead_source = 'social_ad'),
      'source_organic',   count(*) FILTER (WHERE lead_source IS NULL OR lead_source = 'website')
    ),
    count(*)
  INTO v_counts, v_total
  FROM base;

  INSERT INTO public.daily_lead_stats_snapshot(snapshot_date, team_scope, counts, lead_count, snapshotted_at, is_locked)
  VALUES (p_date, 'all', COALESCE(v_counts, '{}'::jsonb), COALESCE(v_total, 0), now(), true)
  ON CONFLICT (snapshot_date, team_scope) DO UPDATE
    SET counts         = EXCLUDED.counts,
        lead_count     = EXCLUDED.lead_count,
        snapshotted_at = now()
    WHERE daily_lead_stats_snapshot.is_locked = false;
END;
$function$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-daily-lead-counts') THEN
    PERFORM cron.unschedule('snapshot-daily-lead-counts');
  END IF;
END $$;

SELECT cron.schedule(
  'snapshot-daily-lead-counts',
  '10 0 * * *',
  $cron$SELECT public.snapshot_daily_lead_counts(((now() AT TIME ZONE 'Europe/London')::date - 1));$cron$
);

SELECT public.snapshot_daily_lead_counts(((now() AT TIME ZONE 'Europe/London')::date - 1));
