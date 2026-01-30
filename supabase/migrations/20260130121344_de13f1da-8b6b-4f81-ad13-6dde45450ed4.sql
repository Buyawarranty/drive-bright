-- Fix the claim_lead_for_agent function to only check last_interaction_at timestamp
-- The status field is unreliable due to race conditions with heartbeat updates

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
    v_result JSONB;
BEGIN
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
    
    -- FIXED: Only check last_interaction_at, not status (status has race conditions with heartbeat)
    -- Agent is considered active if they interacted within the last 90 seconds
    IF v_settings.active_only_distribution 
       AND (v_presence IS NULL 
            OR v_presence.last_interaction_at IS NULL
            OR v_presence.last_interaction_at < now() - INTERVAL '90 seconds') THEN
        RETURN jsonb_build_object('success', false, 'error', 'You must be Active to claim leads. Please interact with the page first.');
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