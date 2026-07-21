CREATE OR REPLACE FUNCTION public.sweep_open_round_robin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_blue uuid := '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';
  v_lead RECORD;
  v_call_count int;
  v_last_call timestamptz;
  v_last_outcome text;
  v_new_agent uuid;
  v_reclaimed int := 0;
  v_dormant   int := 0;
  v_assigned  int := 0;
  v_enabled boolean;
  v_any_on_duty boolean;
BEGIN
  SELECT open_round_robin_enabled INTO v_enabled
  FROM public.lead_distribution_settings
  WHERE team_id = v_team_blue;

  IF v_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  -- Overnight backlog: assign unassigned Team Blue leads once agents are on duty
  SELECT EXISTS(
    SELECT 1
    FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
    JOIN public.lead_team_members ltm ON ltm.admin_user_id = adc.admin_user_id
    WHERE ltm.team_id = v_team_blue
      AND ltm.workstream_new_leads = true
      AND au.is_active = true
      AND au.role IN ('sales', 'sales_lead')
      AND (adc.paused IS NULL OR adc.paused = false)
      AND public.is_agent_on_duty(adc.admin_user_id)
  ) INTO v_any_on_duty;

  IF v_any_on_duty THEN
    FOR v_lead IN
      SELECT sl.id, sl.lead_source
      FROM public.sales_leads sl
      WHERE sl.assigned_to IS NULL
        AND sl.status NOT IN ('converted', 'lost', 'fake_lead', 'dormant', 'archived')
        AND sl.created_at >= now() - interval '7 days'
        AND EXISTS (
          SELECT 1
          FROM public.lead_team_source_rules r
          WHERE r.team_id = v_team_blue
            AND r.allowed = true
            AND r.source = COALESCE(sl.lead_source::text, 'unknown')
        )
      ORDER BY sl.created_at ASC
      LIMIT 50
    LOOP
      v_new_agent := public.pick_agent_for_distribution(
        v_team_blue,
        COALESCE(v_lead.lead_source::text, 'unknown')
      );

      IF v_new_agent IS NOT NULL THEN
        UPDATE public.sales_leads
        SET assigned_to = v_new_agent,
            assigned_at = now()
        WHERE id = v_lead.id;

        INSERT INTO public.lead_assignment_audit (
          lead_id, assigned_to_id, assignment_type, reason
        ) VALUES (
          v_lead.id, v_new_agent, 'open_round_robin', 'orr_overnight_backlog'
        );

        v_assigned := v_assigned + 1;
      END IF;
    END LOOP;
  END IF;

  -- Reclaim / retry / dormant logic for assigned Team Blue leads
  FOR v_lead IN
    SELECT sl.id, sl.assigned_to, sl.assigned_at, sl.lead_source,
           sl.orr_first_call_deadline, sl.orr_retry_deadline,
           sl.orr_reassign_count, sl.call_count
    FROM public.sales_leads sl
    WHERE sl.assigned_to IS NOT NULL
      AND sl.status NOT IN ('converted', 'lost', 'fake_lead', 'dormant', 'archived')
      AND public.is_agent_on_team_blue(sl.assigned_to)
      AND (
        (sl.orr_first_call_deadline IS NOT NULL AND sl.orr_first_call_deadline < now())
        OR (sl.orr_retry_deadline IS NOT NULL AND sl.orr_retry_deadline < now())
      )
    ORDER BY COALESCE(sl.orr_first_call_deadline, sl.orr_retry_deadline) ASC
    LIMIT 200
  LOOP
    SELECT count(*), max(created_at)
      INTO v_call_count, v_last_call
    FROM public.lead_call_logs
    WHERE lead_id = v_lead.id::text
      AND created_at >= COALESCE(v_lead.assigned_at, now() - interval '1 day');

    SELECT outcome INTO v_last_outcome
    FROM public.lead_call_logs
    WHERE lead_id = v_lead.id::text
    ORDER BY created_at DESC
    LIMIT 1;

    IF COALESCE(v_lead.call_count, 0) >= 7
       AND COALESCE(v_last_outcome, '') NOT IN ('spoken', 'contacted', 'sale', 'callback_booked')
    THEN
      UPDATE public.sales_leads
      SET status = 'dormant',
          orr_dormant_at = now(),
          orr_first_call_deadline = NULL,
          orr_retry_deadline = NULL,
          assigned_to = NULL
      WHERE id = v_lead.id;
      v_dormant := v_dormant + 1;
      CONTINUE;
    END IF;

    IF v_lead.orr_first_call_deadline IS NOT NULL
       AND v_lead.orr_first_call_deadline < now()
       AND v_call_count = 0
    THEN
      NULL;
    ELSIF v_lead.orr_first_call_deadline IS NOT NULL
          AND v_lead.orr_first_call_deadline < now()
          AND v_call_count > 0
    THEN
      UPDATE public.sales_leads
      SET orr_first_call_deadline = NULL,
          orr_retry_deadline = COALESCE(v_last_call, now()) + interval '10 minutes'
      WHERE id = v_lead.id;
      CONTINUE;
    ELSIF v_lead.orr_retry_deadline IS NOT NULL
          AND v_lead.orr_retry_deadline < now()
          AND (v_last_call IS NULL OR v_last_call < (v_lead.orr_retry_deadline - interval '10 minutes'))
    THEN
      NULL;
    ELSE
      UPDATE public.sales_leads
      SET orr_retry_deadline = NULL,
          orr_first_call_deadline = NULL
      WHERE id = v_lead.id;
      CONTINUE;
    END IF;

    v_new_agent := public.pick_agent_for_distribution(
      v_team_blue,
      COALESCE(v_lead.lead_source::text, 'unknown')
    );

    IF v_new_agent IS NOT NULL AND v_new_agent <> v_lead.assigned_to THEN
      UPDATE public.sales_leads
      SET assigned_to = v_new_agent,
          assigned_at = now(),
          orr_reassign_count = COALESCE(orr_reassign_count, 0) + 1,
          orr_retry_deadline = NULL
      WHERE id = v_lead.id;

      INSERT INTO public.lead_assignment_audit (
        lead_id, assigned_to_id, assignment_type, reason
      ) VALUES (
        v_lead.id, v_new_agent, 'open_round_robin',
        CASE WHEN v_call_count = 0
             THEN 'orr_missed_first_call'
             ELSE 'orr_missed_retry_window' END
      );
      v_reclaimed := v_reclaimed + 1;
    ELSE
      UPDATE public.sales_leads
      SET orr_first_call_deadline = now() + interval '2 minutes',
          orr_retry_deadline = NULL
      WHERE id = v_lead.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'enabled', true,
    'reclaimed', v_reclaimed,
    'dormant', v_dormant,
    'assigned_overnight', v_assigned,
    'ran_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sweep_open_round_robin() TO authenticated, service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('sweep-open-round-robin');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sweep-open-round-robin',
  '* * * * *',
  $$ SELECT public.sweep_open_round_robin(); $$
);
