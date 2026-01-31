-- Update get_next_eligible_agent to exclude admin role users
-- Leads should only be assigned to sales agents, never to admins
CREATE OR REPLACE FUNCTION public.get_next_eligible_agent(p_exclude_agent_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings RECORD;
    v_next_agent_id UUID;
    v_overflow_id UUID;
BEGIN
    -- Reset caps if needed
    PERFORM reset_daily_caps();
    
    -- Get distribution settings
    SELECT * INTO v_settings FROM lead_distribution_settings LIMIT 1;
    
    -- Solo mode: return the solo agent if enabled (only if not an admin)
    IF v_settings.solo_mode_enabled AND v_settings.solo_agent_id IS NOT NULL THEN
        -- Verify solo agent is not an admin
        IF EXISTS (SELECT 1 FROM admin_users WHERE id = v_settings.solo_agent_id AND role != 'admin') THEN
            RETURN v_settings.solo_agent_id;
        END IF;
    END IF;
    
    -- Find eligible agent: active, not paused, under cap, NOT an admin
    SELECT adc.admin_user_id INTO v_next_agent_id
    FROM agent_distribution_caps adc
    INNER JOIN admin_users au ON au.id = adc.admin_user_id
    LEFT JOIN user_presence up ON up.admin_user_id = adc.admin_user_id
    WHERE au.is_active = true
        AND au.role != 'admin'  -- CRITICAL: Never assign leads to admin users
        AND adc.paused = false
        AND COALESCE(up.is_paused_receiving, false) = false
        AND adc.assigned_today < adc.daily_cap
        AND (p_exclude_agent_id IS NULL OR adc.admin_user_id != p_exclude_agent_id)
        AND (
            v_settings.active_only_distribution = false
            OR (
                up.status = 'online'
                AND up.last_interaction_at > now() - INTERVAL '90 seconds'
            )
        )
    ORDER BY 
        adc.assigned_today ASC,
        adc.last_assigned_at ASC NULLS FIRST
    LIMIT 1;
    
    -- If no eligible agent found, try overflow recipient (only if not admin)
    IF v_next_agent_id IS NULL AND v_settings.overflow_recipient_id IS NOT NULL THEN
        -- Check if overflow recipient is available and not an admin (ignore cap for overflow)
        SELECT adc.admin_user_id INTO v_next_agent_id
        FROM agent_distribution_caps adc
        INNER JOIN admin_users au ON au.id = adc.admin_user_id
        LEFT JOIN user_presence up ON up.admin_user_id = adc.admin_user_id
        WHERE adc.admin_user_id = v_settings.overflow_recipient_id
            AND au.is_active = true
            AND au.role != 'admin'  -- CRITICAL: Overflow recipient cannot be admin
            AND COALESCE(adc.paused, false) = false
            AND (
                v_settings.active_only_distribution = false
                OR up.status = 'online'
            );
    END IF;
    
    -- If still no agent found, return NULL (lead stays as new, unassigned)
    RETURN v_next_agent_id;
END;
$$;

-- Update claim_lead_for_agent to prevent admins from claiming leads
CREATE OR REPLACE FUNCTION public.claim_lead_for_agent(p_lead_id uuid, p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settings RECORD;
    v_agent_cap RECORD;
    v_presence RECORD;
    v_agent_role TEXT;
    v_result JSONB;
BEGIN
    -- CRITICAL: Check if the agent is an admin - admins cannot claim leads
    SELECT role INTO v_agent_role FROM admin_users WHERE id = p_agent_id;
    
    IF v_agent_role = 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Administrators cannot claim leads. Leads are for sales agents only.');
    END IF;
    
    -- Get settings
    SELECT * INTO v_settings FROM lead_distribution_settings LIMIT 1;
    
    -- Reset caps if needed
    PERFORM reset_daily_caps();
    
    -- Get agent cap info
    SELECT * INTO v_agent_cap FROM agent_distribution_caps WHERE admin_user_id = p_agent_id FOR UPDATE;
    
    -- Get presence
    SELECT * INTO v_presence FROM user_presence WHERE admin_user_id = p_agent_id;
    
    -- Check if agent can claim
    IF v_agent_cap IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agent not configured for distribution');
    END IF;
    
    IF v_agent_cap.paused THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agent is paused from receiving leads');
    END IF;
    
    IF v_agent_cap.assigned_today >= v_agent_cap.daily_cap 
       AND p_agent_id != v_settings.overflow_recipient_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Daily cap reached');
    END IF;
    
    IF v_settings.active_only_distribution 
       AND (v_presence IS NULL OR v_presence.status != 'online' 
            OR v_presence.last_interaction_at < now() - INTERVAL '90 seconds') THEN
        RETURN jsonb_build_object('success', false, 'error', 'You must be Active to claim leads. Interact with the page.');
    END IF;
    
    -- Assign the lead using admin_users.id (p_agent_id) directly
    UPDATE sales_leads
    SET assigned_to = p_agent_id,
        assigned_at = now(),
        updated_at = now()
    WHERE id = p_lead_id
        AND assigned_to IS NULL;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lead already assigned or not found');
    END IF;
    
    -- Update agent stats
    UPDATE agent_distribution_caps
    SET assigned_today = assigned_today + 1,
        last_assigned_at = now(),
        updated_at = now()
    WHERE admin_user_id = p_agent_id;
    
    -- Log the assignment
    INSERT INTO lead_assignment_audit (
        lead_id, assigned_to_id, assigned_by, assignment_type, reason,
        agent_cap_at_time, agent_assigned_today_at_time, agent_presence_status, eligible_agents_count
    ) VALUES (
        p_lead_id, p_agent_id, 'agent_claim', 'claim', 'Agent clicked Get Next Lead',
        v_agent_cap.daily_cap, v_agent_cap.assigned_today + 1, 
        COALESCE(v_presence.status, 'unknown'), 1
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Lead assigned successfully');
END;
$$;