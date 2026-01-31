-- Update get_next_eligible_agent to ensure offline agents are NEVER selected
-- An agent must have interacted within the last 90 seconds to be considered online
CREATE OR REPLACE FUNCTION public.get_next_eligible_agent(p_distribution_mode text DEFAULT 'round_robin')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_selected_agent_id uuid;
    v_settings RECORD;
    v_now timestamp with time zone := now();
    v_active_threshold timestamp with time zone := v_now - interval '90 seconds';
BEGIN
    -- Get distribution settings
    SELECT * INTO v_settings FROM lead_distribution_settings LIMIT 1;
    
    -- Check if solo mode is enabled
    IF v_settings.solo_mode_enabled AND v_settings.solo_agent_id IS NOT NULL THEN
        -- Verify solo agent is NOT admin and is ONLINE (active within 90 seconds)
        SELECT au.id INTO v_selected_agent_id
        FROM admin_users au
        JOIN user_presence up ON up.admin_user_id = au.id
        LEFT JOIN agent_distribution_caps adc ON adc.admin_user_id = au.id
        WHERE au.id = v_settings.solo_agent_id
          AND au.is_active = true
          AND au.role != 'admin'  -- CRITICAL: Never assign to admin
          AND (adc.paused IS NULL OR adc.paused = false)
          AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
          AND up.last_interaction_at >= v_active_threshold  -- MUST be online
          AND (up.is_paused_receiving IS NULL OR up.is_paused_receiving = false);
        
        IF v_selected_agent_id IS NOT NULL THEN
            RETURN v_selected_agent_id;
        END IF;
        -- If solo agent is offline/admin/unavailable, fall through to normal distribution
    END IF;
    
    -- Round Robin mode: Select the agent who was assigned longest ago (or never)
    -- CRITICAL: Only select agents who are ONLINE (active within 90 seconds) and NOT admin
    IF p_distribution_mode = 'round_robin' THEN
        SELECT au.id INTO v_selected_agent_id
        FROM admin_users au
        JOIN agent_distribution_caps adc ON adc.admin_user_id = au.id
        JOIN user_presence up ON up.admin_user_id = au.id
        WHERE au.is_active = true
          AND au.role != 'admin'  -- CRITICAL: Never assign to admin
          AND adc.paused = false
          AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
          AND up.last_interaction_at >= v_active_threshold  -- MUST be online (within 90 seconds)
          AND (up.is_paused_receiving IS NULL OR up.is_paused_receiving = false)
        ORDER BY adc.last_assigned_at NULLS FIRST, au.created_at ASC
        LIMIT 1;
        
        -- If no online agents available, check overflow recipient
        IF v_selected_agent_id IS NULL AND v_settings.overflow_recipient_id IS NOT NULL THEN
            -- Verify overflow recipient is NOT admin and is ONLINE
            SELECT au.id INTO v_selected_agent_id
            FROM admin_users au
            JOIN user_presence up ON up.admin_user_id = au.id
            LEFT JOIN agent_distribution_caps adc ON adc.admin_user_id = au.id
            WHERE au.id = v_settings.overflow_recipient_id
              AND au.is_active = true
              AND au.role != 'admin'  -- CRITICAL: Never assign to admin
              AND (adc.paused IS NULL OR adc.paused = false)
              AND up.last_interaction_at >= v_active_threshold  -- MUST be online
              AND (up.is_paused_receiving IS NULL OR up.is_paused_receiving = false);
        END IF;
        
        -- Return NULL if no eligible online agent found - lead stays unassigned
        RETURN v_selected_agent_id;
    END IF;
    
    -- For percentage mode or unknown modes, use round robin logic
    RETURN v_selected_agent_id;
END;
$$;

-- Update claim_lead_for_agent to ensure admins cannot claim leads
-- and offline agents cannot claim leads
CREATE OR REPLACE FUNCTION public.claim_lead_for_agent(p_lead_id uuid, p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agent_cap RECORD;
    v_lead RECORD;
    v_agent_role text;
    v_now timestamp with time zone := now();
    v_active_threshold timestamp with time zone := v_now - interval '90 seconds';
    v_is_online boolean;
BEGIN
    -- Check if agent exists and get their role
    SELECT role INTO v_agent_role FROM admin_users WHERE id = p_agent_id;
    
    IF v_agent_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agent not found.');
    END IF;
    
    -- CRITICAL: Administrators cannot claim leads
    IF v_agent_role = 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Administrators cannot claim leads. Leads are for sales agents only.');
    END IF;
    
    -- Check if agent is online (active within 90 seconds)
    SELECT EXISTS (
        SELECT 1 FROM user_presence up
        WHERE up.admin_user_id = p_agent_id
          AND up.last_interaction_at >= v_active_threshold
    ) INTO v_is_online;
    
    IF NOT v_is_online THEN
        RETURN jsonb_build_object('success', false, 'error', 'You must be online to claim leads. Please refresh the page or check your connection.');
    END IF;
    
    -- Check if lead exists and is unassigned
    SELECT * INTO v_lead FROM sales_leads WHERE id = p_lead_id;
    
    IF v_lead IS NULL THEN
        -- Check abandoned_carts
        SELECT * INTO v_lead FROM abandoned_carts WHERE id = p_lead_id;
        IF v_lead IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Lead not found.');
        END IF;
    END IF;
    
    -- Get or create agent cap record
    SELECT * INTO v_agent_cap FROM agent_distribution_caps WHERE admin_user_id = p_agent_id;
    
    IF v_agent_cap IS NULL THEN
        -- Create cap record with default values
        INSERT INTO agent_distribution_caps (admin_user_id, daily_cap, assigned_today, paused)
        VALUES (p_agent_id, 20, 0, false)
        RETURNING * INTO v_agent_cap;
    END IF;
    
    -- Check if agent is paused
    IF v_agent_cap.paused = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Your lead receiving is currently paused.');
    END IF;
    
    -- Check daily cap
    IF v_agent_cap.daily_cap IS NOT NULL AND v_agent_cap.assigned_today >= v_agent_cap.daily_cap THEN
        RETURN jsonb_build_object('success', false, 'error', 'You have reached your daily lead cap.');
    END IF;
    
    -- Assign the lead
    UPDATE sales_leads 
    SET assigned_to = p_agent_id, updated_at = v_now
    WHERE id = p_lead_id;
    
    -- Update agent cap
    UPDATE agent_distribution_caps 
    SET assigned_today = assigned_today + 1, last_assigned_at = v_now
    WHERE admin_user_id = p_agent_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Lead successfully claimed!');
END;
$$;