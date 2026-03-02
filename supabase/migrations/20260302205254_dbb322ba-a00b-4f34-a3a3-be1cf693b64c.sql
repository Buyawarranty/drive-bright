
-- Fix the race condition in round-robin assignment by adding FOR UPDATE locking
-- This ensures concurrent lead inserts are serialized so the sequence is strict: James→Isobel→Ash→James→...

CREATE OR REPLACE FUNCTION public.auto_assign_lead_round_robin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_settings RECORD;
    v_next_agent RECORD;
    v_now timestamp with time zone := now();
    v_last_assigned_id UUID;
    v_last_sort_order INT;
    v_total_assigned_today INT;
    v_overflow_recipient RECORD;
    v_last_overflow_id UUID;
BEGIN
    IF NEW.assigned_to IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    IF NEW.status IN ('lost', 'fake_lead') THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_settings FROM lead_distribution_settings LIMIT 1;
    
    IF v_settings IS NULL THEN
        RETURN NEW;
    END IF;

    -- Solo mode
    IF v_settings.solo_mode_enabled AND v_settings.solo_agent_id IS NOT NULL THEN
        SELECT adc.* INTO v_next_agent
        FROM agent_distribution_caps adc
        WHERE adc.admin_user_id = v_settings.solo_agent_id
          AND (adc.paused IS NULL OR adc.paused = false);
        
        IF v_next_agent IS NOT NULL THEN
            NEW.assigned_to := v_settings.solo_agent_id;
            UPDATE agent_distribution_caps 
            SET assigned_today = COALESCE(assigned_today, 0) + 1, last_assigned_at = v_now
            WHERE admin_user_id = v_settings.solo_agent_id;
            RETURN NEW;
        END IF;
    END IF;

    -- Percentage mode
    IF v_settings.distribution_mode = 'percentage' THEN
        SELECT COALESCE(SUM(adc.assigned_today), 0) INTO v_total_assigned_today
        FROM agent_distribution_caps adc
        JOIN admin_users au ON au.id = adc.admin_user_id
        WHERE au.is_active = true
          AND (adc.paused IS NULL OR adc.paused = false)
          AND au.role IN ('sales', 'sales_lead')
          AND COALESCE(adc.percentage, 0) > 0;

        SELECT adc.admin_user_id INTO v_next_agent
        FROM agent_distribution_caps adc
        JOIN admin_users au ON au.id = adc.admin_user_id
        WHERE au.is_active = true
          AND (adc.paused IS NULL OR adc.paused = false)
          AND au.role IN ('sales', 'sales_lead')
          AND COALESCE(adc.percentage, 0) > 0
          AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
        ORDER BY 
          ((COALESCE(adc.percentage, 0)::numeric / 100.0) * (v_total_assigned_today + 1)) - COALESCE(adc.assigned_today, 0) DESC,
          adc.last_assigned_at ASC NULLS FIRST
        LIMIT 1;

        IF v_next_agent IS NOT NULL THEN
            NEW.assigned_to := v_next_agent.admin_user_id;
            UPDATE agent_distribution_caps 
            SET assigned_today = COALESCE(assigned_today, 0) + 1, last_assigned_at = v_now
            WHERE admin_user_id = v_next_agent.admin_user_id;
        END IF;
        RETURN NEW;
    END IF;

    -- ==========================================
    -- ROUND ROBIN (strict sort_order: 1→2→3→1→2→3)
    -- CRITICAL: FOR UPDATE locks the row to prevent concurrent inserts
    -- from reading the same pointer and skipping agents
    -- ==========================================
    SELECT last_assigned_user_id INTO v_last_assigned_id 
    FROM round_robin_state 
    LIMIT 1
    FOR UPDATE;

    -- Get sort_order of last assigned agent
    SELECT sort_order INTO v_last_sort_order
    FROM agent_distribution_caps
    WHERE admin_user_id = v_last_assigned_id;

    -- Find NEXT agent by sort_order (strictly greater than last)
    SELECT adc.* INTO v_next_agent
    FROM agent_distribution_caps adc
    JOIN admin_users au ON au.id = adc.admin_user_id
    WHERE au.is_active = true
      AND (adc.paused IS NULL OR adc.paused = false)
      AND au.role IN ('sales', 'sales_lead')
      AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
      AND (v_last_sort_order IS NULL OR adc.sort_order > v_last_sort_order)
    ORDER BY adc.sort_order ASC
    LIMIT 1;

    -- Wrap around to the beginning
    IF v_next_agent IS NULL THEN
        SELECT adc.* INTO v_next_agent
        FROM agent_distribution_caps adc
        JOIN admin_users au ON au.id = adc.admin_user_id
        WHERE au.is_active = true
          AND (adc.paused IS NULL OR adc.paused = false)
          AND au.role IN ('sales', 'sales_lead')
          AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
        ORDER BY adc.sort_order ASC
        LIMIT 1;
    END IF;

    IF v_next_agent IS NOT NULL THEN
        NEW.assigned_to := v_next_agent.admin_user_id;
        
        UPDATE agent_distribution_caps 
        SET assigned_today = COALESCE(assigned_today, 0) + 1, last_assigned_at = v_now
        WHERE admin_user_id = v_next_agent.admin_user_id;

        UPDATE round_robin_state 
        SET last_assigned_user_id = v_next_agent.admin_user_id, updated_at = v_now;
        
        IF NOT FOUND THEN
            INSERT INTO round_robin_state (last_assigned_user_id, updated_at)
            VALUES (v_next_agent.admin_user_id, v_now);
        END IF;
    ELSE
        -- All agents at cap → overflow recipients
        SELECT last_assigned_overflow_id INTO v_last_overflow_id
        FROM overflow_round_robin_state 
        LIMIT 1
        FOR UPDATE;

        SELECT * INTO v_overflow_recipient
        FROM overflow_recipients
        WHERE is_active = true
          AND (v_last_overflow_id IS NULL OR id > v_last_overflow_id)
        ORDER BY sort_order ASC, id ASC
        LIMIT 1;

        IF v_overflow_recipient IS NULL THEN
            SELECT * INTO v_overflow_recipient
            FROM overflow_recipients
            WHERE is_active = true
            ORDER BY sort_order ASC, id ASC
            LIMIT 1;
        END IF;

        IF v_overflow_recipient IS NOT NULL THEN
            NEW.assigned_to := v_overflow_recipient.admin_user_id;
            
            UPDATE overflow_round_robin_state
            SET last_assigned_overflow_id = v_overflow_recipient.id, updated_at = v_now;

            UPDATE agent_distribution_caps 
            SET assigned_today = COALESCE(assigned_today, 0) + 1, last_assigned_at = v_now
            WHERE admin_user_id = v_overflow_recipient.admin_user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- Also fix get_next_sales_user to use the same FOR UPDATE pattern
CREATE OR REPLACE FUNCTION public.get_next_sales_user()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_next_user_id uuid;
  v_last_user_id uuid;
  v_last_sort_order integer;
BEGIN
  PERFORM public.reset_daily_caps();

  -- Lock the round_robin_state row to prevent races
  SELECT last_assigned_user_id INTO v_last_user_id
  FROM public.round_robin_state
  LIMIT 1
  FOR UPDATE;

  SELECT adc.sort_order INTO v_last_sort_order
  FROM public.agent_distribution_caps adc
  WHERE adc.admin_user_id = v_last_user_id;

  -- Find next by sort_order
  SELECT adc.admin_user_id INTO v_next_user_id
  FROM public.agent_distribution_caps adc
  JOIN public.admin_users au ON au.id = adc.admin_user_id
  WHERE au.is_active = true
    AND au.role IN ('sales', 'sales_lead')
    AND COALESCE(adc.paused, false) = false
    AND (adc.daily_cap IS NULL OR COALESCE(adc.assigned_today, 0) < adc.daily_cap)
    AND (v_last_sort_order IS NULL OR adc.sort_order > v_last_sort_order)
  ORDER BY adc.sort_order ASC NULLS LAST
  LIMIT 1;

  -- Wrap around
  IF v_next_user_id IS NULL THEN
    SELECT adc.admin_user_id INTO v_next_user_id
    FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
    WHERE au.is_active = true
      AND au.role IN ('sales', 'sales_lead')
      AND COALESCE(adc.paused, false) = false
      AND (adc.daily_cap IS NULL OR COALESCE(adc.assigned_today, 0) < adc.daily_cap)
    ORDER BY adc.sort_order ASC NULLS LAST
    LIMIT 1;
  END IF;

  -- Update round_robin_state pointer
  IF v_next_user_id IS NOT NULL THEN
    UPDATE public.round_robin_state
    SET last_assigned_user_id = v_next_user_id, updated_at = now();
    
    IF NOT FOUND THEN
      INSERT INTO public.round_robin_state (last_assigned_user_id, updated_at)
      VALUES (v_next_user_id, now());
    END IF;
  END IF;

  RETURN v_next_user_id;
END;
$function$;
