CREATE OR REPLACE FUNCTION public.orr_queue_dashboard_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now  timestamptz := now();
  v_today_london date := (v_now AT TIME ZONE 'Europe/London')::date;
  v_result jsonb;
BEGIN
  WITH
  leads AS (
    SELECT id, status, assigned_to, phone_normalized,
           orr_pool_state, orr_pool_kind, orr_pool_next_open_at, orr_pool_since,
           orr_attempt_count, orr_next_release_at, orr_locked_until,
           orr_first_call_deadline, orr_retry_deadline,
           orr_first_call_kind, orr_last_attempt_at, orr_dormant_at,
           first_name, last_name, created_at
    FROM public.sales_leads
    WHERE status NOT IN ('converted','lost','not_interested','fake_lead','do_not_contact','wrong_number')
  ),
  latest_lock AS (
    SELECT DISTINCT ON (phone_normalized)
      phone_normalized, to_state, created_at
    FROM public.customer_lock_events
    WHERE phone_normalized IS NOT NULL
    ORDER BY phone_normalized, created_at DESC
  ),
  counts AS (
    SELECT
      COUNT(*) FILTER (WHERE orr_pool_state='waiting' AND orr_pool_kind='live')          AS live_waiting,
      COUNT(*) FILTER (WHERE orr_pool_state='waiting' AND orr_pool_kind='overnight')     AS overnight_waiting,
      COUNT(*) FILTER (WHERE orr_pool_state='waiting' AND orr_pool_kind='morning_retry') AS morning_waiting,
      COUNT(*) FILTER (WHERE orr_pool_state='waiting' AND orr_pool_kind='lunch_retry')   AS lunch_waiting,
      COUNT(*) FILTER (WHERE orr_pool_state='waiting' AND orr_pool_kind='evening_retry') AS evening_waiting,
      COUNT(*) FILTER (WHERE orr_locked_until IS NOT NULL AND orr_locked_until > v_now) AS assigned_timer,
      COUNT(*) FILTER (WHERE orr_pool_state='waiting' AND orr_pool_next_open_at IS NOT NULL AND orr_pool_next_open_at > v_now) AS waiting_agents_busy,
      COUNT(*) FILTER (WHERE orr_pool_state='waiting' AND orr_pool_next_open_at IS NOT NULL AND orr_pool_next_open_at - v_now < interval '5 minutes') AS approaching_close,
      COUNT(*) FILTER (WHERE orr_next_release_at IS NOT NULL AND orr_next_release_at < v_now) AS rolled_over,
      COUNT(*) FILTER (WHERE orr_last_attempt_at IS NOT NULL AND orr_pool_state='outcome_missing') AS missing_outcomes,
      COUNT(*) FILTER (WHERE orr_locked_until IS NOT NULL AND orr_locked_until < v_now AND orr_last_attempt_at IS NULL) AS expired_assignments,
      (SELECT COUNT(*) FROM latest_lock WHERE to_state = 'locked') AS customers_locked,
      (SELECT COUNT(*) FROM public.lead_call_logs c WHERE c.call_ended_at IS NULL AND c.call_started_at > v_now - interval '2 hours') AS customers_on_calls,
      COUNT(*) FILTER (WHERE orr_dormant_at IS NOT NULL AND orr_dormant_at::date = v_today_london) AS dormant_today
    FROM leads
  ),
  overnight_no_attempt AS (
    SELECT COUNT(*) AS c FROM leads
    WHERE orr_pool_kind='overnight' AND orr_attempt_count = 0
      AND ((v_now AT TIME ZONE 'Europe/London')::time > time '11:00')
  ),
  past_window AS (
    SELECT COUNT(*) AS c FROM leads
    WHERE orr_pool_next_open_at IS NOT NULL AND orr_pool_next_open_at < v_now
  ),
  missing_next AS (
    SELECT COUNT(*) AS c FROM leads
    WHERE orr_pool_state='waiting' AND orr_pool_next_open_at IS NULL
  ),
  dup_phones AS (
    SELECT phone_normalized, COUNT(*) AS c
    FROM leads
    WHERE phone_normalized IS NOT NULL
    GROUP BY phone_normalized
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 20
  ),
  attempts_over AS (
    SELECT COUNT(*) AS c FROM leads WHERE orr_attempt_count > 7
  ),
  double_locks AS (
    SELECT 0::bigint AS c
  ),
  early_calls AS (
    SELECT COUNT(*) AS c
    FROM public.lead_call_logs c
    JOIN leads l ON l.id::text = c.lead_id
    WHERE c.call_started_at > v_now - interval '30 days'
      AND l.orr_pool_next_open_at IS NOT NULL
      AND c.call_started_at < l.orr_pool_next_open_at
  ),
  after_dnc AS (
    SELECT COUNT(*) AS c
    FROM public.lead_call_logs c
    JOIN public.lead_customers lc ON lc.phone_normalized = c.phone_normalized
    WHERE c.call_started_at > v_now - interval '30 days'
      AND c.phone_normalized IS NOT NULL
      AND lc.do_not_call = true
      AND lc.do_not_call_at IS NOT NULL
      AND c.call_started_at > lc.do_not_call_at
  ),
  agents AS (
    SELECT au.id AS agent_id,
           COALESCE(NULLIF(TRIM(au.first_name || ' ' || COALESCE(au.last_name,'')),''), au.email) AS agent_name,
           au.role,
           COALESCE(up.status, 'offline') AS presence,
           (SELECT COUNT(*) FROM public.sales_leads sl
              WHERE sl.assigned_to = au.id
                AND sl.orr_locked_until IS NOT NULL
                AND sl.orr_locked_until > v_now
                AND sl.orr_last_attempt_at IS NULL) AS holding_uncalled,
           (SELECT MIN(sl.orr_locked_until) FROM public.sales_leads sl
              WHERE sl.assigned_to = au.id
                AND sl.orr_locked_until IS NOT NULL
                AND sl.orr_locked_until > v_now) AS next_deadline,
           (SELECT sl.orr_pool_kind FROM public.sales_leads sl
              WHERE sl.assigned_to = au.id
                AND sl.orr_pool_state = 'assigned'
              ORDER BY sl.orr_locked_until DESC NULLS LAST LIMIT 1) AS current_queue,
           (SELECT COUNT(*) FROM public.lead_call_logs c
              WHERE c.agent_id = au.id
                AND c.call_ended_at IS NULL
                AND c.call_started_at > v_now - interval '2 hours') AS live_calls,
           (SELECT COUNT(*) FROM public.lead_reminders lr
              WHERE lr.assigned_to = au.id
                AND lr.status = 'pending'
                AND lr.due_at::date = v_today_london) AS callbacks_owned,
           (SELECT COUNT(*) FROM public.sales_leads sl
              WHERE sl.assigned_to = au.id
                AND sl.status IN ('interested','quoted','callback','follow_up','hot')) AS active_sales
    FROM public.admin_users au
    LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = au.id
    LEFT JOIN public.user_presence up ON up.user_id = au.user_id
    WHERE au.is_active = true
      AND adc.assignment_mode = 'open_pool'
  )
  SELECT jsonb_build_object(
    'generated_at', v_now,
    'counts', jsonb_build_object(
      'live_waiting',         (SELECT live_waiting FROM counts),
      'overnight_waiting',    (SELECT overnight_waiting FROM counts),
      'morning_waiting',      (SELECT morning_waiting FROM counts),
      'lunch_waiting',        (SELECT lunch_waiting FROM counts),
      'evening_waiting',      (SELECT evening_waiting FROM counts),
      'assigned_locked',      (SELECT assigned_timer FROM counts),
      'waiting_agents_busy',  (SELECT waiting_agents_busy FROM counts),
      'approaching_close',    (SELECT approaching_close FROM counts),
      'rolled_to_next_queue', (SELECT rolled_over FROM counts),
      'missing_outcomes',     (SELECT missing_outcomes FROM counts),
      'expired_assignments',  (SELECT expired_assignments FROM counts),
      'locked_customers',     (SELECT customers_locked FROM counts),
      'on_call_customers',    (SELECT customers_on_calls FROM counts),
      'dormant_today',        (SELECT dormant_today FROM counts)
    ),
    'warnings', jsonb_build_object(
      'overnight_no_attempt1',    jsonb_build_array(jsonb_build_object('n',(SELECT c FROM overnight_no_attempt))),
      'waiting_past_window',      jsonb_build_array(jsonb_build_object('n',(SELECT c FROM past_window))),
      'missing_next_eligible',    jsonb_build_array(jsonb_build_object('n',(SELECT c FROM missing_next))),
      'duplicate_phones',         COALESCE((SELECT jsonb_agg(jsonb_build_object('phone_normalized',phone_normalized,'n',c)) FROM dup_phones), '[]'::jsonb),
      'attempt_over_7',           jsonb_build_array(jsonb_build_object('n',(SELECT c FROM attempts_over))),
      'double_locks',             jsonb_build_array(jsonb_build_object('n',(SELECT c FROM double_locks))),
      'calls_before_eligibility', jsonb_build_array(jsonb_build_object('n',(SELECT c FROM early_calls))),
      'calls_after_dnc',          jsonb_build_array(jsonb_build_object('n',(SELECT c FROM after_dnc)))
    ),
    'agents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'agent_id', agent_id,
        'agent_name', agent_name,
        'role', role,
        'presence', presence,
        'holding_uncalled', holding_uncalled,
        'next_deadline', next_deadline,
        'current_queue', current_queue,
        'live_calls', live_calls,
        'callbacks_owned', callbacks_owned,
        'active_sales', active_sales
      )) FROM agents
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;