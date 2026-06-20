
-- Helper: management role check (admin, super_admin, sales_manager)
CREATE OR REPLACE FUNCTION public.is_management(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin', 'sales_manager')
      AND is_active = true
  );
$$;

-- Daily per-agent stats snapshot table
CREATE TABLE public.agent_daily_lead_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  stat_date date NOT NULL,
  team_id uuid NULL,
  leads_assigned integer NOT NULL DEFAULT 0,
  self_assigned integer NOT NULL DEFAULT 0,
  marked_fake integer NOT NULL DEFAULT 0,
  marked_lost integer NOT NULL DEFAULT 0,
  marked_converted integer NOT NULL DEFAULT 0,
  notes_added integer NOT NULL DEFAULT 0,
  callbacks_set integer NOT NULL DEFAULT 0,
  callbacks_completed integer NOT NULL DEFAULT 0,
  calls_logged integer NOT NULL DEFAULT 0,
  status_changes integer NOT NULL DEFAULT 0,
  active_leads_eod integer NOT NULL DEFAULT 0,
  locked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, stat_date)
);

CREATE INDEX idx_adls_date ON public.agent_daily_lead_stats(stat_date DESC);
CREATE INDEX idx_adls_agent_date ON public.agent_daily_lead_stats(agent_id, stat_date DESC);
CREATE INDEX idx_adls_team_date ON public.agent_daily_lead_stats(team_id, stat_date DESC);

GRANT SELECT ON public.agent_daily_lead_stats TO authenticated;
GRANT ALL ON public.agent_daily_lead_stats TO service_role;

ALTER TABLE public.agent_daily_lead_stats ENABLE ROW LEVEL SECURITY;

-- Agents see only their own rows
CREATE POLICY "Agent sees own stats"
ON public.agent_daily_lead_stats
FOR SELECT
TO authenticated
USING (agent_id = auth.uid());

-- Management sees all rows
CREATE POLICY "Management sees all stats"
ON public.agent_daily_lead_stats
FOR SELECT
TO authenticated
USING (public.is_management(auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_agent_daily_lead_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_adls
BEFORE UPDATE ON public.agent_daily_lead_stats
FOR EACH ROW EXECUTE FUNCTION public.touch_agent_daily_lead_stats();

-- Live (today) stats function. Returns per-agent metrics computed from source tables.
-- Returns all agents to management; scopes to the caller for non-management.
CREATE OR REPLACE FUNCTION public.get_agent_live_stats(p_date date)
RETURNS TABLE (
  agent_id uuid,
  stat_date date,
  leads_assigned integer,
  self_assigned integer,
  marked_fake integer,
  marked_lost integer,
  marked_converted integer,
  notes_added integer,
  callbacks_set integer,
  callbacks_completed integer,
  calls_logged integer,
  status_changes integer,
  active_leads_eod integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_mgmt boolean := public.is_management(auth.uid());
  caller uuid := auth.uid();
  day_start timestamptz := (p_date::timestamp AT TIME ZONE 'Europe/London');
  day_end   timestamptz := ((p_date + 1)::timestamp AT TIME ZONE 'Europe/London');
BEGIN
  RETURN QUERY
  WITH base_agents AS (
    SELECT au.user_id AS agent_id
    FROM public.admin_users au
    WHERE au.is_active = true
      AND au.role IN ('sales','sales_lead','sales_manager','lead_gen','admin','super_admin')
      AND (is_mgmt OR au.user_id = caller)
  ),
  assigns AS (
    SELECT c.new_assigned_to AS agent_id,
           count(*) FILTER (WHERE c.new_assigned_to IS DISTINCT FROM c.old_assigned_to)::int AS assigned_cnt,
           count(*) FILTER (WHERE c.new_assigned_to IS DISTINCT FROM c.old_assigned_to
                             AND c.changed_by = c.new_assigned_to)::int AS self_cnt
    FROM public.sales_leads_changelog c
    WHERE c.changed_at >= day_start AND c.changed_at < day_end
      AND c.new_assigned_to IS NOT NULL
    GROUP BY c.new_assigned_to
  ),
  status_changes_q AS (
    SELECT c.changed_by AS agent_id,
           count(*)::int AS total_changes,
           count(*) FILTER (WHERE c.new_status = 'fake_lead')::int AS fakes,
           count(*) FILTER (WHERE c.new_status = 'lost')::int AS losts,
           count(*) FILTER (WHERE c.new_status = 'converted')::int AS converts
    FROM public.sales_leads_changelog c
    WHERE c.changed_at >= day_start AND c.changed_at < day_end
      AND c.new_status IS NOT NULL
      AND c.new_status IS DISTINCT FROM c.old_status
      AND c.changed_by IS NOT NULL
    GROUP BY c.changed_by
  ),
  notes_q AS (
    SELECT n.created_by AS agent_id, count(*)::int AS notes_cnt
    FROM public.lead_quick_notes n
    WHERE n.created_at >= day_start AND n.created_at < day_end
      AND n.created_by IS NOT NULL
    GROUP BY n.created_by
  ),
  callbacks_set_q AS (
    SELECT (r.user_id)::uuid AS agent_id, count(*)::int AS cb_set
    FROM public.lead_reminders r
    WHERE r.created_at >= day_start AND r.created_at < day_end
      AND r.user_id IS NOT NULL
      AND r.user_id ~* '^[0-9a-f-]{36}$'
    GROUP BY (r.user_id)::uuid
  ),
  callbacks_done_q AS (
    SELECT (r.user_id)::uuid AS agent_id, count(*)::int AS cb_done
    FROM public.lead_reminders r
    WHERE r.updated_at >= day_start AND r.updated_at < day_end
      AND r.status IN ('done','completed','acknowledged')
      AND r.user_id IS NOT NULL
      AND r.user_id ~* '^[0-9a-f-]{36}$'
    GROUP BY (r.user_id)::uuid
  ),
  calls_q AS (
    SELECT l.agent_id, count(*)::int AS calls_cnt
    FROM public.lead_call_logs l
    WHERE l.created_at >= day_start AND l.created_at < day_end
      AND l.agent_id IS NOT NULL
    GROUP BY l.agent_id
  ),
  active_eod AS (
    SELECT sl.assigned_to AS agent_id, count(*)::int AS active_cnt
    FROM public.sales_leads sl
    WHERE sl.assigned_to IS NOT NULL
      AND COALESCE(sl.status::text, '') NOT IN ('converted','lost','fake_lead')
      AND sl.assigned_at < day_end
    GROUP BY sl.assigned_to
  )
  SELECT
    ba.agent_id,
    p_date AS stat_date,
    COALESCE(a.assigned_cnt, 0),
    COALESCE(a.self_cnt, 0),
    COALESCE(sc.fakes, 0),
    COALESCE(sc.losts, 0),
    COALESCE(sc.converts, 0),
    COALESCE(nq.notes_cnt, 0),
    COALESCE(cs.cb_set, 0),
    COALESCE(cd.cb_done, 0),
    COALESCE(cl.calls_cnt, 0),
    COALESCE(sc.total_changes, 0),
    COALESCE(ae.active_cnt, 0)
  FROM base_agents ba
  LEFT JOIN assigns a ON a.agent_id = ba.agent_id
  LEFT JOIN status_changes_q sc ON sc.agent_id = ba.agent_id
  LEFT JOIN notes_q nq ON nq.agent_id = ba.agent_id
  LEFT JOIN callbacks_set_q cs ON cs.agent_id = ba.agent_id
  LEFT JOIN callbacks_done_q cd ON cd.agent_id = ba.agent_id
  LEFT JOIN calls_q cl ON cl.agent_id = ba.agent_id
  LEFT JOIN active_eod ae ON ae.agent_id = ba.agent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agent_live_stats(date) TO authenticated;

-- Snapshot function: aggregates a finished day and upserts into agent_daily_lead_stats.
CREATE OR REPLACE FUNCTION public.snapshot_agent_daily_stats(p_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_count integer := 0;
  day_start timestamptz := (p_date::timestamp AT TIME ZONE 'Europe/London');
  day_end   timestamptz := ((p_date + 1)::timestamp AT TIME ZONE 'Europe/London');
BEGIN
  WITH base_agents AS (
    SELECT au.user_id AS agent_id,
           (SELECT lm.team_id FROM public.lead_team_members lm
             WHERE lm.admin_user_id = au.id LIMIT 1) AS team_id
    FROM public.admin_users au
    WHERE au.role IN ('sales','sales_lead','sales_manager','lead_gen','admin','super_admin')
  ),
  assigns AS (
    SELECT c.new_assigned_to AS agent_id,
           count(*) FILTER (WHERE c.new_assigned_to IS DISTINCT FROM c.old_assigned_to)::int AS assigned_cnt,
           count(*) FILTER (WHERE c.new_assigned_to IS DISTINCT FROM c.old_assigned_to
                             AND c.changed_by = c.new_assigned_to)::int AS self_cnt
    FROM public.sales_leads_changelog c
    WHERE c.changed_at >= day_start AND c.changed_at < day_end
      AND c.new_assigned_to IS NOT NULL
    GROUP BY c.new_assigned_to
  ),
  status_q AS (
    SELECT c.changed_by AS agent_id,
           count(*)::int AS total_changes,
           count(*) FILTER (WHERE c.new_status = 'fake_lead')::int AS fakes,
           count(*) FILTER (WHERE c.new_status = 'lost')::int AS losts,
           count(*) FILTER (WHERE c.new_status = 'converted')::int AS converts
    FROM public.sales_leads_changelog c
    WHERE c.changed_at >= day_start AND c.changed_at < day_end
      AND c.new_status IS NOT NULL
      AND c.new_status IS DISTINCT FROM c.old_status
      AND c.changed_by IS NOT NULL
    GROUP BY c.changed_by
  ),
  notes_q AS (
    SELECT n.created_by AS agent_id, count(*)::int AS notes_cnt
    FROM public.lead_quick_notes n
    WHERE n.created_at >= day_start AND n.created_at < day_end
      AND n.created_by IS NOT NULL
    GROUP BY n.created_by
  ),
  cb_set AS (
    SELECT (r.user_id)::uuid AS agent_id, count(*)::int AS cb_set
    FROM public.lead_reminders r
    WHERE r.created_at >= day_start AND r.created_at < day_end
      AND r.user_id IS NOT NULL
      AND r.user_id ~* '^[0-9a-f-]{36}$'
    GROUP BY (r.user_id)::uuid
  ),
  cb_done AS (
    SELECT (r.user_id)::uuid AS agent_id, count(*)::int AS cb_done
    FROM public.lead_reminders r
    WHERE r.updated_at >= day_start AND r.updated_at < day_end
      AND r.status IN ('done','completed','acknowledged')
      AND r.user_id IS NOT NULL
      AND r.user_id ~* '^[0-9a-f-]{36}$'
    GROUP BY (r.user_id)::uuid
  ),
  calls AS (
    SELECT l.agent_id, count(*)::int AS calls_cnt
    FROM public.lead_call_logs l
    WHERE l.created_at >= day_start AND l.created_at < day_end
      AND l.agent_id IS NOT NULL
    GROUP BY l.agent_id
  ),
  active_eod AS (
    SELECT sl.assigned_to AS agent_id, count(*)::int AS active_cnt
    FROM public.sales_leads sl
    WHERE sl.assigned_to IS NOT NULL
      AND COALESCE(sl.status::text, '') NOT IN ('converted','lost','fake_lead')
      AND sl.assigned_at < day_end
    GROUP BY sl.assigned_to
  ),
  combined AS (
    SELECT
      ba.agent_id,
      ba.team_id,
      COALESCE(a.assigned_cnt, 0) AS leads_assigned,
      COALESCE(a.self_cnt, 0) AS self_assigned,
      COALESCE(sq.fakes, 0) AS marked_fake,
      COALESCE(sq.losts, 0) AS marked_lost,
      COALESCE(sq.converts, 0) AS marked_converted,
      COALESCE(nq.notes_cnt, 0) AS notes_added,
      COALESCE(cs.cb_set, 0) AS callbacks_set,
      COALESCE(cd.cb_done, 0) AS callbacks_completed,
      COALESCE(cl.calls_cnt, 0) AS calls_logged,
      COALESCE(sq.total_changes, 0) AS status_changes,
      COALESCE(ae.active_cnt, 0) AS active_leads_eod
    FROM base_agents ba
    LEFT JOIN assigns a ON a.agent_id = ba.agent_id
    LEFT JOIN status_q sq ON sq.agent_id = ba.agent_id
    LEFT JOIN notes_q nq ON nq.agent_id = ba.agent_id
    LEFT JOIN cb_set cs ON cs.agent_id = ba.agent_id
    LEFT JOIN cb_done cd ON cd.agent_id = ba.agent_id
    LEFT JOIN calls cl ON cl.agent_id = ba.agent_id
    LEFT JOIN active_eod ae ON ae.agent_id = ba.agent_id
  )
  INSERT INTO public.agent_daily_lead_stats (
    agent_id, stat_date, team_id,
    leads_assigned, self_assigned, marked_fake, marked_lost, marked_converted,
    notes_added, callbacks_set, callbacks_completed, calls_logged,
    status_changes, active_leads_eod, locked_at
  )
  SELECT
    c.agent_id, p_date, c.team_id,
    c.leads_assigned, c.self_assigned, c.marked_fake, c.marked_lost, c.marked_converted,
    c.notes_added, c.callbacks_set, c.callbacks_completed, c.calls_logged,
    c.status_changes, c.active_leads_eod, now()
  FROM combined c
  ON CONFLICT (agent_id, stat_date) DO UPDATE SET
    team_id = EXCLUDED.team_id,
    leads_assigned = EXCLUDED.leads_assigned,
    self_assigned = EXCLUDED.self_assigned,
    marked_fake = EXCLUDED.marked_fake,
    marked_lost = EXCLUDED.marked_lost,
    marked_converted = EXCLUDED.marked_converted,
    notes_added = EXCLUDED.notes_added,
    callbacks_set = EXCLUDED.callbacks_set,
    callbacks_completed = EXCLUDED.callbacks_completed,
    calls_logged = EXCLUDED.calls_logged,
    status_changes = EXCLUDED.status_changes,
    active_leads_eod = EXCLUDED.active_leads_eod,
    locked_at = now(),
    updated_at = now();

  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_agent_daily_stats(date) TO service_role;
