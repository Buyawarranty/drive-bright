
-- Update the auto-assign function to support percentage split mode
CREATE OR REPLACE FUNCTION public.auto_assign_lead_round_robin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings RECORD;
    v_next_agent RECORD;
    v_now timestamp with time zone := now();
    v_total_assigned_today INT;
    v_total_percentage INT;
BEGIN
    -- Only auto-assign if lead is unassigned
    IF NEW.assigned_to IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Skip non-actionable statuses
    IF NEW.status IN ('lost', 'fake_lead') THEN
        RETURN NEW;
    END IF;

    -- Get distribution settings
    SELECT * INTO v_settings FROM lead_distribution_settings LIMIT 1;
    
    IF v_settings IS NULL THEN
        RETURN NEW;
    END IF;

    -- Solo mode: assign to solo agent if enabled (works for both modes)
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

    -- ==========================================
    -- PERCENTAGE SPLIT MODE
    -- ==========================================
    IF v_settings.distribution_mode = 'percentage' THEN
        -- Get total leads assigned today across all eligible agents
        SELECT COALESCE(SUM(adc.assigned_today), 0) INTO v_total_assigned_today
        FROM agent_distribution_caps adc
        JOIN admin_users au ON au.id = adc.admin_user_id
        WHERE au.is_active = true
          AND (adc.paused IS NULL OR adc.paused = false)
          AND au.role IN ('sales', 'sales_lead')
          AND COALESCE(adc.percentage, 0) > 0;

        -- Pick the eligible agent who is furthest below their target percentage share
        -- target_count = (percentage / 100) * (total_assigned + 1)  [+1 for the incoming lead]
        -- deficit = target_count - assigned_today  (highest deficit = most underserved)
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
        ELSIF v_settings.overflow_recipient_id IS NOT NULL THEN
            NEW.assigned_to := v_settings.overflow_recipient_id;
        END IF;

        RETURN NEW;
    END IF;

    -- ==========================================
    -- ROUND ROBIN MODE (default)
    -- ==========================================
    SELECT adc.admin_user_id INTO v_next_agent
    FROM agent_distribution_caps adc
    JOIN admin_users au ON au.id = adc.admin_user_id
    WHERE au.is_active = true
      AND (adc.paused IS NULL OR adc.paused = false)
      AND au.role IN ('sales', 'sales_lead')
      AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
    ORDER BY adc.last_assigned_at ASC NULLS FIRST
    LIMIT 1;

    IF v_next_agent IS NOT NULL THEN
        NEW.assigned_to := v_next_agent.admin_user_id;
        
        UPDATE agent_distribution_caps 
        SET assigned_today = COALESCE(assigned_today, 0) + 1, last_assigned_at = v_now
        WHERE admin_user_id = v_next_agent.admin_user_id;
    ELSIF v_settings.overflow_recipient_id IS NOT NULL THEN
        NEW.assigned_to := v_settings.overflow_recipient_id;
    END IF;

    RETURN NEW;
END;
$$;
