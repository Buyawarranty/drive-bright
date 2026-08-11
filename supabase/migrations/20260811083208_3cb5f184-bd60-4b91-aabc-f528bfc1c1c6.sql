CREATE OR REPLACE FUNCTION public.auto_assign_lead_round_robin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_team_rule RECORD;
  v_assigned uuid;
  v_routing_enabled boolean := false;
  v_source text;
  v_cap_check jsonb;
  v_preassigned uuid;
  v_preassigned_paused boolean := false;
  v_preassigned_works_new boolean := true;
  v_preassigned_mode text := 'round_robin';
  v_flow_mode text := 'round_robin';
  v_alt_next text := 'rr';
  v_settings_id uuid;
  v_overflow_id uuid;
  v_overflow_hops int := 0;
  v_visited uuid[] := ARRAY[]::uuid[];
  v_target_team uuid;
  v_sticky_owner uuid;
  v_sticky_lead uuid;
  v_sticky_match text;
  v_phone_tail text;
  v_email text;
  v_name text;
BEGIN
  IF NEW.status IN ('lost', 'fake_lead') THEN
    RETURN NEW;
  END IF;

  -- ── Owner-sticky / REPEAT CUSTOMER: a person we already dealt with always goes
  -- back to the same agent. Matching is on phone (last 9 digits) OR email OR full
  -- name, so a new email address or a different registration plate does not break
  -- the link. The agent's online/paused state is deliberately IGNORED here — a
  -- repeat customer belongs to their agent whether or not they are switched on.
  IF NEW.assigned_to IS NULL THEN
    BEGIN
      v_phone_tail := NULLIF(RIGHT(COALESCE(public.normalize_uk_phone(NEW.phone), ''), 9), '');
      v_email := NULLIF(lower(btrim(COALESCE(NEW.email, ''))), '');
      v_name := NULLIF(lower(regexp_replace(COALESCE(NEW.first_name,'') || COALESCE(NEW.last_name,''), '[^a-zA-Z0-9]', '', 'g')), '');
      -- Guard against weak name matches (initials, "test", blanks)
      IF v_name IS NOT NULL AND char_length(v_name) < 7 THEN v_name := NULL; END IF;

      IF v_phone_tail IS NOT NULL OR v_email IS NOT NULL OR v_name IS NOT NULL THEN
        SELECT sl.id, sl.assigned_to,
               CASE
                 WHEN v_phone_tail IS NOT NULL AND RIGHT(COALESCE(public.normalize_uk_phone(sl.phone),''), 9) = v_phone_tail THEN 'phone'
                 WHEN v_email IS NOT NULL AND lower(btrim(COALESCE(sl.email,''))) = v_email THEN 'email'
                 ELSE 'name'
               END
          INTO v_sticky_lead, v_sticky_owner, v_sticky_match
        FROM public.sales_leads sl
        JOIN public.admin_users au ON au.id = sl.assigned_to
        WHERE sl.id <> NEW.id
          AND sl.assigned_to IS NOT NULL
          AND au.is_active = true
          AND au.archived_at IS NULL
          AND au.role IN ('sales','sales_lead')
          AND sl.status NOT IN ('lost','fake_lead','do_not_contact','archived')
          AND (
            (v_phone_tail IS NOT NULL
              AND sl.phone IS NOT NULL AND btrim(sl.phone) <> ''
              AND RIGHT(COALESCE(public.normalize_uk_phone(sl.phone),''), 9) = v_phone_tail)
            OR
            (v_email IS NOT NULL AND lower(btrim(COALESCE(sl.email,''))) = v_email)
            OR
            (v_name IS NOT NULL
              AND NULLIF(lower(regexp_replace(COALESCE(sl.first_name,'') || COALESCE(sl.last_name,''), '[^a-zA-Z0-9]', '', 'g')), '') = v_name)
          )
        ORDER BY
          -- strongest signal first: phone, then email, then name
          CASE
            WHEN v_phone_tail IS NOT NULL AND RIGHT(COALESCE(public.normalize_uk_phone(sl.phone),''), 9) = v_phone_tail THEN 0
            WHEN v_email IS NOT NULL AND lower(btrim(COALESCE(sl.email,''))) = v_email THEN 1
            ELSE 2
          END,
          sl.updated_at DESC
        LIMIT 1;
      END IF;

      -- Fallback: no prior lead, but we have an existing CUSTOMER record owned by
      -- an agent (they bought before under another email/plate).
      IF v_sticky_owner IS NULL AND (v_phone_tail IS NOT NULL OR v_email IS NOT NULL OR v_name IS NOT NULL) THEN
        SELECT c.assigned_to,
               CASE
                 WHEN v_phone_tail IS NOT NULL AND RIGHT(COALESCE(public.normalize_uk_phone(c.phone),''), 9) = v_phone_tail THEN 'customer_phone'
                 WHEN v_email IS NOT NULL AND lower(btrim(COALESCE(c.email,''))) = v_email THEN 'customer_email'
                 ELSE 'customer_name'
               END
          INTO v_sticky_owner, v_sticky_match
        FROM public.customers c
        JOIN public.admin_users au ON au.id = c.assigned_to
        WHERE c.assigned_to IS NOT NULL
          AND au.is_active = true
          AND au.archived_at IS NULL
          AND au.role IN ('sales','sales_lead')
          AND COALESCE(lower(c.status), '') NOT IN ('cancelled','refunded')
          AND (
            (v_phone_tail IS NOT NULL AND c.phone IS NOT NULL AND btrim(c.phone) <> ''
              AND RIGHT(COALESCE(public.normalize_uk_phone(c.phone),''), 9) = v_phone_tail)
            OR (v_email IS NOT NULL AND lower(btrim(COALESCE(c.email,''))) = v_email)
            OR (v_name IS NOT NULL
              AND NULLIF(lower(regexp_replace(COALESCE(c.name,''), '[^a-zA-Z0-9]', '', 'g')), '') = v_name)
          )
        ORDER BY c.updated_at DESC NULLS LAST
        LIMIT 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_sticky_owner := NULL;
    END;

    IF v_sticky_owner IS NOT NULL THEN
      NEW.assigned_to := v_sticky_owner;
      NEW.owner_agent := v_sticky_owner;
      NEW.assigned_at := now();
      NEW.queue := 'live_new';
      NEW.auto_tags := (
        SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(NEW.auto_tags, ARRAY[]::text[]) || ARRAY['same_customer_sticky','repeat_customer']))
      );
      BEGIN
        UPDATE public.agent_distribution_caps
           SET last_assigned_at = now()
         WHERE admin_user_id = v_sticky_owner;
      EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, v_sticky_owner, NULL, 'same_customer_sticky',
                format('Repeat customer (matched on %s%s) → kept with existing owner, online state ignored',
                       COALESCE(v_sticky_match,'unknown'),
                       CASE WHEN v_sticky_lead IS NOT NULL THEN format(', prior lead %s', v_sticky_lead) ELSE '' END));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      RETURN NEW;
    END IF;
  END IF;

  PERFORM public.reset_daily_caps();

  SELECT id, COALESCE(flow_mode,'round_robin'), COALESCE(alternating_next,'rr')
    INTO v_settings_id, v_flow_mode, v_alt_next
  FROM public.lead_distribution_settings
  WHERE team_id IS NULL
  LIMIT 1;

  IF NEW.assigned_to IS NOT NULL THEN
    v_preassigned := NEW.assigned_to;
    SELECT COALESCE(paused, false), COALESCE(assignment_mode,'round_robin')
      INTO v_preassigned_paused, v_preassigned_mode
    FROM public.agent_distribution_caps WHERE admin_user_id = v_preassigned;
    v_preassigned_works_new := public.agent_works_new_leads(v_preassigned);

    IF v_preassigned_paused THEN
      BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'paused_reroute', format('preassigned agent %s is paused', v_preassigned));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      NEW.assigned_to := NULL;
    ELSIF v_preassigned_mode = 'open_pool' THEN
      BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'open_pool_reroute', format('preassigned agent %s is on Open Pool', v_preassigned));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      NEW.assigned_to := NULL;
    ELSIF NOT v_preassigned_works_new THEN
      BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'workstream_reroute', format('preassigned agent %s not on New Leads', v_preassigned));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      NEW.assigned_to := NULL;
    ELSE
      v_cap_check := public.enforce_agent_cap(v_preassigned, false);
      IF (v_cap_check->>'ok')::boolean THEN
        UPDATE public.agent_distribution_caps
        SET assigned_today = COALESCE(assigned_today,0) + 1, last_assigned_at = now()
        WHERE admin_user_id = v_preassigned;
        RETURN NEW;
      END IF;
      BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (NEW.id, NULL, NULL, 'cap_reroute', format('preassigned agent at cap (%s/%s)', v_cap_check->>'current', v_cap_check->>'cap'));
      EXCEPTION WHEN OTHERS THEN NULL; END;
      NEW.assigned_to := NULL;
    END IF;
  END IF;

  IF v_flow_mode = 'open_pool_only' THEN
    NEW.assigned_to := NULL;
    NEW.owner_agent := NULL;
    NEW.queue := 'live_open_pool';
    NEW.pool_status := 'new';
    BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'flow_mode_pool_only', 'flow_mode=open_pool_only');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN NEW;
  END IF;

  IF v_flow_mode = 'alternating' AND v_alt_next = 'pool' THEN
    IF v_settings_id IS NOT NULL THEN
      UPDATE public.lead_distribution_settings
      SET alternating_next = 'rr', alternating_counter_date = CURRENT_DATE, updated_at = now()
      WHERE id = v_settings_id;
    END IF;
    NEW.assigned_to := NULL;
    NEW.owner_agent := NULL;
    NEW.queue := 'live_open_pool';
    NEW.pool_status := 'new';
    BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'alternating_pool_slot', 'alternating flow: this slot → Open Pool');
    EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN NEW;
  END IF;

  SELECT COALESCE((setting_value)::text::boolean, false) INTO v_routing_enabled
  FROM public.lead_settings WHERE setting_key = 'team_routing_enabled' LIMIT 1;

  v_source := COALESCE(NEW.lead_source::text, 'unknown');

  IF v_routing_enabled THEN
    FOR v_team_rule IN
      WITH eligible_rules AS (
        SELECT r.team_id, t.name AS team_name, r.priority, r.created_at,
               GREATEST(COALESCE(r.percentage, CASE WHEN r.allowed THEN 100 ELSE 0 END), 0)::numeric AS percentage,
               r.daily_cap, r.overflow_team_id
        FROM public.lead_team_source_rules r
        JOIN public.lead_teams t ON t.id = r.team_id
        WHERE r.allowed = true AND t.is_active = true AND r.source = v_source
          AND GREATEST(COALESCE(r.percentage, CASE WHEN r.allowed THEN 100 ELSE 0 END), 0) > 0
      ), team_counts AS (
        SELECT er.team_id, COUNT(sl.id)::numeric AS assigned_count
        FROM eligible_rules er
        LEFT JOIN public.lead_team_members tm ON tm.team_id = er.team_id
        LEFT JOIN public.sales_leads sl ON sl.assigned_to = tm.admin_user_id
          AND sl.created_at >= date_trunc('day', now())
          AND COALESCE(sl.lead_source::text, 'unknown') = v_source
        GROUP BY er.team_id
      ), totals AS (
        SELECT COALESCE(SUM(assigned_count), 0) AS total_assigned FROM team_counts
      )
      SELECT er.team_id, er.team_name, er.priority, er.percentage, er.daily_cap, er.overflow_team_id,
             tc.assigned_count
      FROM eligible_rules er
      JOIN team_counts tc ON tc.team_id = er.team_id
      CROSS JOIN totals tot
      ORDER BY er.priority ASC,
        ((er.percentage / 100.0) * (tot.total_assigned + 1)) - tc.assigned_count DESC,
        er.created_at ASC
    LOOP
      v_target_team := v_team_rule.team_id;
      v_overflow_hops := 0;
      v_visited := ARRAY[]::uuid[];

      IF v_team_rule.daily_cap IS NOT NULL AND v_team_rule.assigned_count >= v_team_rule.daily_cap THEN
        BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
          VALUES (NEW.id, NULL, NULL, 'team_cap_hit',
                  format('team %s hit daily cap %s/%s for %s', v_team_rule.team_name, v_team_rule.assigned_count, v_team_rule.daily_cap, v_source));
        EXCEPTION WHEN OTHERS THEN NULL; END;

        v_overflow_id := v_team_rule.overflow_team_id;
        WHILE v_overflow_id IS NOT NULL AND v_overflow_hops < 5 LOOP
          IF v_overflow_id = ANY(v_visited) THEN EXIT; END IF;
          v_visited := v_visited || v_overflow_id;
          v_assigned := public.pick_agent_for_distribution(v_overflow_id, v_source);
          IF v_assigned IS NOT NULL THEN
            NEW.assigned_to := v_assigned;
            BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
              VALUES (NEW.id, v_assigned, NULL, 'overflow_routed',
                      format('overflow from %s → team %s', v_team_rule.team_name, v_overflow_id));
            EXCEPTION WHEN OTHERS THEN NULL; END;
            IF v_flow_mode = 'alternating' AND v_settings_id IS NOT NULL THEN
              UPDATE public.lead_distribution_settings
              SET alternating_next = 'pool', alternating_counter_date = CURRENT_DATE, updated_at = now()
              WHERE id = v_settings_id;
            END IF;
            RETURN NEW;
          END IF;
          SELECT overflow_team_id INTO v_overflow_id
          FROM public.lead_team_source_rules
          WHERE team_id = v_overflow_id AND source = v_source
          LIMIT 1;
          v_overflow_hops := v_overflow_hops + 1;
        END LOOP;
        CONTINUE;
      END IF;

      v_assigned := public.pick_agent_for_distribution(v_target_team, v_source);
      IF v_assigned IS NOT NULL THEN
        NEW.assigned_to := v_assigned;
        IF v_flow_mode = 'alternating' AND v_settings_id IS NOT NULL THEN
          UPDATE public.lead_distribution_settings
          SET alternating_next = 'pool', alternating_counter_date = CURRENT_DATE, updated_at = now()
          WHERE id = v_settings_id;
        END IF;
        RETURN NEW;
      END IF;
    END LOOP;
  END IF;

  v_assigned := public.pick_agent_for_distribution(NULL, v_source);
  IF v_assigned IS NOT NULL THEN
    NEW.assigned_to := v_assigned;
    IF v_flow_mode = 'alternating' AND v_settings_id IS NOT NULL THEN
      UPDATE public.lead_distribution_settings
      SET alternating_next = 'pool', alternating_counter_date = CURRENT_DATE, updated_at = now()
      WHERE id = v_settings_id;
    END IF;
    RETURN NEW;
  END IF;

  IF v_flow_mode = 'alternating' THEN
    NEW.assigned_to := NULL;
    NEW.owner_agent := NULL;
    NEW.queue := 'live_open_pool';
    NEW.pool_status := 'new';
    BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (NEW.id, NULL, NULL, 'alternating_rr_spill', 'alternating: RR pool empty/capped → parked in Open Pool');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN NEW;
END;
$function$;