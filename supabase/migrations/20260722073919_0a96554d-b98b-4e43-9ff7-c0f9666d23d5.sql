
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
      COUNT(*) FILTER (WHERE assigned_to IS NOT NULL AND orr_locked_until IS NOT NULL AND orr_locked_until > v_now) AS assigned_locked,
      COUNT(*) FILTER (WHERE orr_pool_state='waiting' AND orr_pool_next_open_at IS NOT NULL AND orr_pool_next_open_at > v_now) AS waiting_agents_busy,
      COUNT(*) FILTER (WHERE orr_pool_state='waiting' AND orr_pool_next_open_at IS NOT NULL AND orr_pool_next_open_at BETWEEN v_now AND v_now + interval '10 minutes') AS approaching_close,
      COUNT(*) FILTER (WHERE orr_pool_kind IN ('morning_retry','lunch_retry','evening_retry') AND orr_last_attempt_at IS NULL AND (orr_pool_since IS NOT NULL AND orr_pool_since < v_now - interval '2 hours')) AS rolled_to_next_queue,
      COUNT(*) FILTER (WHERE assigned_to IS NOT NULL AND orr_locked_until IS NOT NULL AND orr_locked_until < v_now AND orr_attempt_count > 0 AND orr_last_attempt_at IS NULL) AS missing_outcomes,
      COUNT(*) FILTER (WHERE assigned_to IS NOT NULL AND orr_first_call_deadline IS NOT NULL AND orr_first_call_deadline < v_now - interval '5 minutes' AND orr_last_attempt_at IS NULL) AS expired_assignments
    FROM leads
  ),
  customers AS (
    SELECT
      COUNT(*) FILTER (WHERE lock_state IN ('contacted_owned','call_in_progress','cooling_off') AND (lock_until IS NULL OR lock_until > v_now)) AS locked_customers,
      COUNT(*) FILTER (WHERE lock_state='call_in_progress') AS on_call_customers
    FROM public.lead_customers
  ),
  dormant AS (
    SELECT COUNT(*) AS dormant_today
    FROM public.sales_leads
    WHERE orr_dormant_at IS NOT NULL
      AND (orr_dormant_at AT TIME ZONE 'Europe/London')::date = v_today_london
  ),
  w_overnight_no_a1 AS (
    SELECT id, first_name, last_name, phone_normalized, created_at
    FROM leads
    WHERE orr_pool_kind='overnight'
      AND orr_attempt_count = 0
      AND (v_now AT TIME ZONE 'Europe/London')::time > time '11:00'
      AND (v_now AT TIME ZONE 'Europe/London')::date = (created_at AT TIME ZONE 'Europe/London')::date
    LIMIT 100
  ),
  w_past_window AS (
    SELECT id, first_name, last_name, phone_normalized, orr_pool_kind, orr_pool_next_open_at
    FROM leads
    WHERE orr_pool_state='waiting'
      AND orr_pool_next_open_at IS NOT NULL
      AND orr_pool_next_open_at < v_now - interval '5 minutes'
    LIMIT 100
  ),
  w_missing_next AS (
    SELECT id, first_name, last_name, phone_normalized, orr_attempt_count
    FROM leads
    WHERE orr_attempt_count BETWEEN 1 AND 6
      AND orr_next_release_at IS NULL
      AND orr_pool_state IS DISTINCT FROM 'assigned'
      AND status NOT IN ('callback_booked')
    LIMIT 100
  ),
  w_dupes AS (
    SELECT phone_normalized, COUNT(*) AS n
    FROM leads
    WHERE phone_normalized IS NOT NULL
    GROUP BY phone_normalized
    HAVING COUNT(*) > 1
    ORDER BY n DESC
    LIMIT 100
  ),
  w_attempt_over_7 AS (
    SELECT id, first_name, last_name, phone_normalized, orr_attempt_count
    FROM leads
    WHERE orr_attempt_count > 7
    LIMIT 100
  ),
  w_double_locks AS (
    SELECT phone_normalized, COUNT(*) AS n
    FROM public.lead_customers
    WHERE lock_state IN ('contacted_owned','call_in_progress')
      AND (lock_until IS NULL OR lock_until > v_now)
    GROUP BY phone_normalized
    HAVING COUNT(*) > 1
    LIMIT 50
  ),
  w_before_eligibility AS (
    SELECT c.id, c.lead_id, c.phone_normalized, c.agent_name, c.call_started_at
    FROM public.lead_call_logs c
    JOIN public.sales_leads sl ON sl.id = c.lead_id
    WHERE c.call_started_at > v_now - interval '24 hours'
      AND sl.orr_next_release_at IS NOT NULL
      AND c.call_started_at < sl.orr_next_release_at
    ORDER BY c.call_started_at DESC
    LIMIT 50
  ),
  w_after_dnc AS (
    SELECT c.id, c.lead_id, c.phone_normalized, c.agent_name, c.call_started_at
    FROM public.lead_call_logs c
    JOIN public.lead_customers lc ON lc.phone_normalized = c.phone_normalized
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
      'assigned_locked', c.assigned_locked,
      'waiting_agents_busy', c.waiting_agents_busy,
      'approaching_close', c.approaching_close,
      'rolled_to_next_queue', c.rolled_to_next_queue,
      'missing_outcomes', c.missing_outcomes,
      'expired_assignments', c.expired_assignments,
      'locked_customers', cu.locked_customers,
      'on_call_customers', cu.on_call_customers,
      'dormant_today', d.dormant_today
    ) FROM counts c, customers cu, dormant d),
    'warnings', jsonb_build_object(
      'overnight_no_attempt1', (SELECT COALESCE(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM w_overnight_no_a1 w),
      'waiting_past_window',   (SELECT COALESCE(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM w_past_window w),
      'missing_next_eligible', (SELECT COALESCE(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM w_missing_next w),
      'duplicate_phones',      (SELECT COALESCE(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM w_dupes w),
      'attempt_over_7',        (SELECT COALESCE(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM w_attempt_over_7 w),
      'double_locks',          (SELECT COALESCE(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM w_double_locks w),
      'calls_before_eligibility', (SELECT COALESCE(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM w_before_eligibility w),
      'calls_after_dnc',       (SELECT COALESCE(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM w_after_dnc w)
    ),
    'agents', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.agent_name),'[]'::jsonb) FROM agent_state a)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
