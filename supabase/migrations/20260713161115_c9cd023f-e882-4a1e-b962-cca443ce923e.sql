-- Track how many pool → RR promotions a lead has been through
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS pool_recycle_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sales_leads_recycle_pool
  ON public.sales_leads (queue, assigned_to, last_action_at)
  WHERE queue IN ('live_open_pool','live_new');

-- =====================================================================
-- open_pool_recycle_stale
-- Two phases, called from cron every ~3 min:
--   1. Pool → RR: leads sitting in live_open_pool unassigned for >15 min
--                 get pushed to a round-robin agent (up to 2 cycles).
--   2. RR → Pool: leads previously recycled to RR that the agent hasn't
--                 actioned within 30 min go back into the pool.
--   After 2 cycles a lead is flagged 'stale_needs_manager' and stays
--   with the current owner (or in pool if unassigned) — no more churn.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.open_pool_recycle_stale()
RETURNS TABLE(
  promoted_to_rr integer,
  returned_to_pool integer,
  flagged_stale integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _lead RECORD;
  _agent uuid;
  _cap jsonb;
  _promoted int := 0;
  _returned int := 0;
  _flagged int := 0;
BEGIN
  PERFORM public.reset_daily_caps();

  -- ---------------------------------------------------------------
  -- Phase 1: Pool → RR (stale > 15 min, cycles < 2)
  -- ---------------------------------------------------------------
  FOR _lead IN
    SELECT id, lead_source, pool_recycle_count
      FROM public.sales_leads
     WHERE queue = 'live_open_pool'
       AND assigned_to IS NULL
       AND owner_agent IS NULL
       AND status NOT IN ('lost','converted','fake_lead')
       AND (pool_status IS NULL OR pool_status IN ('new','callback_booked','contacted'))
       AND (locked_by IS NULL OR locked_at < now() - interval '7 minutes')
       AND COALESCE(pool_recycle_count, 0) < 2
       AND COALESCE(last_action_at, created_at) < now() - interval '15 minutes'
     ORDER BY COALESCE(priority_score, 0) DESC, created_at ASC
     LIMIT 200
     FOR UPDATE SKIP LOCKED
  LOOP
    _agent := public.pick_agent_for_distribution(NULL, COALESCE(_lead.lead_source::text,'unknown'));
    IF _agent IS NULL THEN CONTINUE; END IF;

    _cap := public.enforce_agent_cap(_agent, false);
    IF NOT (_cap->>'ok')::boolean THEN CONTINUE; END IF;

    UPDATE public.sales_leads
       SET assigned_to        = _agent,
           owner_agent        = _agent,
           assigned_at        = COALESCE(assigned_at, now()),
           queue              = 'live_new',
           pool_status        = 'new',
           last_action_at     = now(),
           updated_at         = now(),
           pool_recycle_count = COALESCE(pool_recycle_count, 0) + 1,
           auto_tags = (
             SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['recycled_from_pool']))
           )
     WHERE id = _lead.id;

    UPDATE public.agent_distribution_caps
       SET assigned_today = COALESCE(assigned_today,0) + 1,
           last_assigned_at = now()
     WHERE admin_user_id = _agent;

    -- Remove from shark_tank_pool if it was queued there
    DELETE FROM public.shark_tank_pool WHERE lead_id = _lead.id;

    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (_lead.id, _agent, NULL, 'pool_stale_recycled_to_rr',
              format('Stale >15min in Open Pool → RR (cycle %s/2)', COALESCE(_lead.pool_recycle_count,0)+1));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      INSERT INTO public.lead_activities (lead_id, activity_type, description)
      VALUES (_lead.id, 'system',
              format('Auto-recycled from Open Pool to agent (stale >15min, cycle %s/2)',
                     COALESCE(_lead.pool_recycle_count,0)+1));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    _promoted := _promoted + 1;
  END LOOP;

  -- ---------------------------------------------------------------
  -- Phase 2: RR → Pool (agent hasn't actioned in 30 min, cycles < 2)
  -- Only recycles leads that were previously promoted from pool
  -- (auto_tags contains 'recycled_from_pool') — normal RR leads are
  -- untouched.
  -- ---------------------------------------------------------------
  FOR _lead IN
    SELECT id, pool_recycle_count
      FROM public.sales_leads
     WHERE queue = 'live_new'
       AND assigned_to IS NOT NULL
       AND status NOT IN ('lost','converted','fake_lead')
       AND COALESCE(pool_status,'new') = 'new'
       AND 'recycled_from_pool' = ANY(COALESCE(auto_tags, ARRAY[]::text[]))
       AND COALESCE(pool_recycle_count, 0) < 2
       AND COALESCE(last_action_at, assigned_at, created_at) < now() - interval '30 minutes'
     ORDER BY assigned_at ASC
     LIMIT 200
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.sales_leads
       SET assigned_to    = NULL,
           owner_agent    = NULL,
           queue          = 'live_open_pool',
           pool_status    = 'new',
           locked_by      = NULL,
           locked_at      = NULL,
           last_action_at = now(),
           updated_at     = now()
     WHERE id = _lead.id;

    BEGIN
      INSERT INTO public.shark_tank_pool(lead_id, team_id, status)
      VALUES (_lead.id, NULL, 'queued')
      ON CONFLICT (lead_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (_lead.id, NULL, NULL, 'rr_stale_returned_to_pool',
              format('Agent inactive >30min → returned to Open Pool (cycle %s used)', _lead.pool_recycle_count));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
      INSERT INTO public.lead_activities (lead_id, activity_type, description)
      VALUES (_lead.id, 'system', 'Returned to Open Pool — agent inactive >30min');
    EXCEPTION WHEN OTHERS THEN NULL; END;

    _returned := _returned + 1;
  END LOOP;

  -- ---------------------------------------------------------------
  -- Phase 3: Escalate — used 2 cycles and still stale
  -- Tag as 'stale_needs_manager' so managers can act on it.
  -- ---------------------------------------------------------------
  FOR _lead IN
    SELECT id
      FROM public.sales_leads
     WHERE status NOT IN ('lost','converted','fake_lead')
       AND COALESCE(pool_status,'new') IN ('new','callback_booked','contacted')
       AND COALESCE(pool_recycle_count, 0) >= 2
       AND NOT ('stale_needs_manager' = ANY(COALESCE(auto_tags, ARRAY[]::text[])))
       AND COALESCE(last_action_at, assigned_at, created_at) < now() - interval '30 minutes'
     LIMIT 200
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.sales_leads
       SET auto_tags = (
             SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['stale_needs_manager']))
           ),
           updated_at = now()
     WHERE id = _lead.id;

    BEGIN
      INSERT INTO public.lead_activities (lead_id, activity_type, description)
      VALUES (_lead.id, 'system', 'Flagged stale — used 2 recycle cycles, needs manager attention');
    EXCEPTION WHEN OTHERS THEN NULL; END;

    _flagged := _flagged + 1;
  END LOOP;

  promoted_to_rr := _promoted;
  returned_to_pool := _returned;
  flagged_stale := _flagged;
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.open_pool_recycle_stale() TO authenticated, service_role;

-- Schedule every 3 minutes
DO $$ BEGIN PERFORM cron.unschedule('open_pool_recycle_stale'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'open_pool_recycle_stale',
  '*/3 * * * *',
  $cron$ SELECT public.open_pool_recycle_stale(); $cron$
);
