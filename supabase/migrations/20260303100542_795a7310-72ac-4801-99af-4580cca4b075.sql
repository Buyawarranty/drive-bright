
-- CRITICAL FIX: The auto_assign_lead_round_robin trigger has UPDATE statements
-- without WHERE clauses, which are blocked by pg_safeupdate extension.
-- This has been silently killing ALL lead inserts since the extension was enabled.

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
    v_rr_id UUID;
    v_overflow_rr_id UUID;
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
    -- ==========================================
    SELECT id, last_assigned_user_id INTO v_rr_id, v_last_assigned_id 
    FROM round_robin_state 
    LIMIT 1
    FOR UPDATE;

    SELECT sort_order INTO v_last_sort_order
    FROM agent_distribution_caps
    WHERE admin_user_id = v_last_assigned_id;

    -- Find NEXT agent by sort_order
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

    -- Wrap around
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

        -- FIX: Added WHERE clause to satisfy pg_safeupdate
        IF v_rr_id IS NOT NULL THEN
            UPDATE round_robin_state 
            SET last_assigned_user_id = v_next_agent.admin_user_id, updated_at = v_now
            WHERE id = v_rr_id;
        ELSE
            INSERT INTO round_robin_state (last_assigned_user_id, updated_at)
            VALUES (v_next_agent.admin_user_id, v_now);
        END IF;
    ELSE
        -- All agents at cap → overflow recipients
        SELECT id, last_assigned_overflow_id INTO v_overflow_rr_id, v_last_overflow_id
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
            
            -- FIX: Added WHERE clause to satisfy pg_safeupdate
            IF v_overflow_rr_id IS NOT NULL THEN
                UPDATE overflow_round_robin_state
                SET last_assigned_overflow_id = v_overflow_recipient.id, updated_at = v_now
                WHERE id = v_overflow_rr_id;
            ELSE
                INSERT INTO overflow_round_robin_state (last_assigned_overflow_id, updated_at)
                VALUES (v_overflow_recipient.id, v_now);
            END IF;

            UPDATE agent_distribution_caps 
            SET assigned_today = COALESCE(assigned_today, 0) + 1, last_assigned_at = v_now
            WHERE admin_user_id = v_overflow_recipient.admin_user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
