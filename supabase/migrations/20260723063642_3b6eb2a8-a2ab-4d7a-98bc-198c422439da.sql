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
      (SELECT COUNT(DISTINCT phone_normalized) FROM public.customer_lock_events WHERE released_at IS NULL) AS customers_locked,
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
    SELECT COUNT(*) AS c FROM (
      SELECT phone_normalized FROM public.customer_lock_events
      WHERE released_at IS NULL
      GROUP BY phone_normalized HAVING COUNT(*) > 1
    ) x
  ),
  early_calls AS (
    SELECT COUNT(*) AS c
    FROM public.lead_call_logs c
    JOIN leads l ON l.id = c.lead_id
    WHERE c.call_started_at > v_now - interval '30 days'
      AND l.orr_pool_next_open_at IS NOT NULL
      AND c.call_started_at < l.orr_pool_next_open_at
  ),
  after_dnc AS (
    SELECT COUNT(*) AS c
    FROM public.lead_call_logs c
    JOIN public.lead_customers lc ON lc.id = c.lead_customer_id
    WHERE c.call_started_at > v_now - interval '30 days'
      AND lc.do_not_call = true
      AND lc.do_not_call_at IS NOT NULL
      AND c.call_started_at > lc.do_not_call_at
    ORDER BY c.call_started_at DESC
    LIMIT 50
  ),
  agents AS (
    SELECT au.user_id AS agent_id,
           COALESCE(NULLIF(TRIM(CONCAT(au.first_name,' ',au.last_name)),''), au.email) AS agent_name,
           au.role::text AS role,
           up.status AS presence,
           up.last_activity_at
    FROM public.admin_users au
    JOIN public.agent_distribution_caps adc
      ON adc.agent_id = au.user_id AND adc.assignment_mode = 'open_pool'
    LEFT JOIN public.user_presence up ON up.user_id = au.user_id
    WHERE COALESCE(au.is_active,true) = true
      AND au.role::text IN ('sales','sales_lead')
  ),
  agent_state AS (
    SELECT a.agent_id, a.agent_name, a.role,
           COALESCE(a.presence,'offline') AS presence,
           (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = a.agent_id AND l.orr_locked_until IS NOT NULL AND l.orr_locked_until > v_now AND l.orr_last_attempt_at IS NULL) AS holding_uncalled,
           (SELECT MIN(l.orr_first_call_deadline) FROM leads l WHERE l.assigned_to = a.agent_id AND l.orr_first_call_deadline > v_now) AS next_deadline,
           (SELECT MAX(l.orr_pool_kind::text) FROM leads l WHERE l.assigned_to = a.agent_id AND l.orr_locked_until > v_now) AS current_queue,
           (SELECT COUNT(*) FROM public.lead_call_logs c WHERE c.agent_id = a.agent_id AND c.call_ended_at IS NULL AND c.call_started_at > v_now - interval '2 hours') AS live_calls,
           (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = a.agent_id AND l.status = 'callback_booked') AS callbacks_owned,
           (SELECT COUNT(*) FROM public.customers cu WHERE cu.assigned_to = a.agent_id AND cu.created_at > v_now - interval '24 hours' AND cu.status IN ('active','processing','pending_verification')) AS active_sales
    FROM agents a
  )
  SELECT jsonb_build_object(
    'generated_at', v_now,
    'counts', (SELECT jsonb_build_object(
      'live_waiting', c.live_waiting,
      'overnight_waiting', c.overnight_waiting,
      'morning_waiting', c.morning_waiting,
      'lunch_waiting', c.lunch_waiting,
      'evening_waiting', c.evening_waiting,
      'assigned_timer', c.assigned_timer,
      'waiting_agents_busy', c.waiting_agents_busy,
      'approaching_close', c.approaching_close,
      'rolled_over', c.rolled_over,
      'missing_outcomes', c.missing_outcomes,
      'expired_assignments', c.expired_assignments,
      'customers_locked', c.customers_locked,
      'customers_on_calls', c.customers_on_calls,
      'dormant_today', c.dormant_today,
      'overnight_no_attempt', (SELECT c FROM overnight_no_attempt),
      'past_window', (SELECT c FROM past_window),
      'missing_next', (SELECT c FROM missing_next),
      'attempts_over', (SELECT c FROM attempts_over),
      'double_locks', (SELECT c FROM double_locks),
      'early_calls', (SELECT c FROM early_calls),
      'after_dnc', (SELECT c FROM after_dnc)
    ) FROM counts c),
    'dup_phones', (SELECT COALESCE(jsonb_agg(jsonb_build_object('phone', phone_normalized, 'count', c)),'[]'::jsonb) FROM dup_phones),
    'agents', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.agent_name),'[]'::jsonb) FROM agent_state a)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;