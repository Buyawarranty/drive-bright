
-- ============================================================
-- A: INSTANT FLOW 24/7 — kill overnight_queue / morning_call_queue routing
-- ============================================================

-- 1. Auto-tag trigger: overnight leads go straight to live_open_pool (not overnight_queue)
CREATE OR REPLACE FUNCTION public.open_pool_auto_tag_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tags text[] := ARRAY[]::text[];
  _hour_uk integer;
  _in_hours boolean;
BEGIN
  IF NEW.lead_source::text = 'google_ad' THEN
    _tags := _tags || ARRAY['paid_google', 'high_priority'];
  ELSIF NEW.lead_source::text = 'social_ad' THEN
    _tags := _tags || ARRAY['paid_facebook', 'high_priority'];
  ELSIF NEW.lead_source::text = 'website' THEN
    _tags := _tags || ARRAY['website_quote'];
  END IF;

  _hour_uk := EXTRACT(HOUR FROM (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Europe/London'));
  _in_hours := (_hour_uk >= 9 AND _hour_uk < 18);

  IF NEW.pool_status IS NULL THEN
    NEW.pool_status := 'new';
  END IF;

  -- ALWAYS route to live_open_pool by default (no more overnight_queue holding).
  -- RR trigger will override to 'owned_by_agent' if it can assign.
  IF NEW.queue IS NULL THEN
    NEW.queue := 'live_open_pool';
  END IF;

  IF NOT _in_hours THEN
    _tags := _tags || ARRAY['overnight_lead'];
  END IF;

  IF array_length(_tags, 1) IS NOT NULL THEN
    NEW.auto_tags := (
      SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(NEW.auto_tags, ARRAY[]::text[]) || _tags))
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. When RR assigns, flip queue to owned_by_agent so it doesn't sit in a pool bucket.
--    Patch the two RETURN NEW paths where NEW.assigned_to gets set.
CREATE OR REPLACE FUNCTION public.mark_lead_owned_after_rr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND (NEW.queue IS NULL OR NEW.queue IN ('live_open_pool','overnight_queue','morning_call_queue')) THEN
    NEW.queue := 'owned_by_agent';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mark_lead_owned_after_rr ON public.sales_leads;
CREATE TRIGGER trg_mark_lead_owned_after_rr
  BEFORE INSERT ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_lead_owned_after_rr();

-- 3. Retire the overnight promotion cron logic — turn it into a no-op safety net
--    that just moves any straggler overnight_queue rows into live_open_pool.
CREATE OR REPLACE FUNCTION public.open_pool_promote_overnight()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _moved integer := 0;
BEGIN
  WITH moved AS (
    UPDATE public.sales_leads
       SET queue = 'live_open_pool',
           pool_status = COALESCE(pool_status,'new'),
           last_action_at = now()
     WHERE queue IN ('overnight_queue','morning_call_queue')
       AND assigned_to IS NULL
       AND COALESCE(pool_status,'new') NOT IN ('converted','lost','invalid')
    RETURNING id
  )
  SELECT count(*) INTO _moved FROM moved;
  RETURN _moved;
END;
$function$;

-- 4. Immediately clear the current backlog: everything held in overnight/morning
--    queues without an owner → live_open_pool right now.
UPDATE public.sales_leads
   SET queue = 'live_open_pool',
       pool_status = COALESCE(pool_status,'new'),
       last_action_at = now(),
       updated_at = now()
 WHERE queue IN ('overnight_queue','morning_call_queue')
   AND assigned_to IS NULL
   AND COALESCE(pool_status,'new') NOT IN ('converted','lost','invalid');

-- ============================================================
-- B: DRIP MODE — off by default, managers flip on when a batch lands
-- ============================================================

ALTER TABLE public.lead_distribution_settings
  ADD COLUMN IF NOT EXISTS drip_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS drip_interval_seconds integer NOT NULL DEFAULT 180;

ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS drip_release_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sales_leads_drip_release_at
  ON public.sales_leads (drip_release_at)
  WHERE drip_release_at IS NOT NULL;

-- Schedule a drip release for a set of already-open-pool leads.
-- Stamps drip_release_at at (now + interval, now + 2*interval, ...).
-- Agents' open-pool view should filter drip_release_at IS NULL OR <= now().
CREATE OR REPLACE FUNCTION public.open_pool_schedule_drip(_lead_ids uuid[], _interval_seconds integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller_role text;
  _iv integer;
  _n integer := 0;
  _id uuid;
  _idx integer := 1;
BEGIN
  SELECT role INTO _caller_role
    FROM public.admin_users
   WHERE user_id = auth.uid() AND is_active = true
   LIMIT 1;
  IF _caller_role IS NULL OR _caller_role NOT IN ('admin','super_admin','sales_manager') THEN
    RAISE EXCEPTION 'Not authorized to schedule drip release';
  END IF;

  IF _interval_seconds IS NULL THEN
    SELECT COALESCE(drip_interval_seconds, 180) INTO _iv
      FROM public.lead_distribution_settings
     WHERE team_id IS NULL LIMIT 1;
  ELSE
    _iv := GREATEST(_interval_seconds, 15);
  END IF;

  FOREACH _id IN ARRAY _lead_ids LOOP
    UPDATE public.sales_leads
       SET drip_release_at = now() + (_iv * _idx || ' seconds')::interval,
           updated_at = now()
     WHERE id = _id
       AND assigned_to IS NULL
       AND queue = 'live_open_pool';
    IF FOUND THEN
      _n := _n + 1;
      _idx := _idx + 1;
      BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (_id, NULL, auth.uid(), 'drip_scheduled',
                format('drip: releases in %s sec', _iv * (_idx - 1)));
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END LOOP;

  RETURN _n;
END;
$function$;

-- Cancel any pending drip (release immediately)
CREATE OR REPLACE FUNCTION public.open_pool_release_drip_now(_lead_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _caller_role text; _n integer := 0;
BEGIN
  SELECT role INTO _caller_role FROM public.admin_users
   WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
  IF _caller_role IS NULL OR _caller_role NOT IN ('admin','super_admin','sales_manager') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH cleared AS (
    UPDATE public.sales_leads
       SET drip_release_at = NULL, updated_at = now()
     WHERE drip_release_at IS NOT NULL
       AND (_lead_ids IS NULL OR id = ANY(_lead_ids))
    RETURNING id
  )
  SELECT count(*) INTO _n FROM cleared;
  RETURN _n;
END;
$function$;
