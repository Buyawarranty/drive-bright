
-- 1. Disable solo mode so round robin works
UPDATE lead_distribution_settings 
SET solo_mode_enabled = false, solo_agent_id = NULL;

-- 2. Create auto-assign function for new leads using round robin
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
    
    -- Only proceed if round_robin mode
    IF v_settings IS NULL OR v_settings.distribution_mode != 'round_robin' THEN
        RETURN NEW;
    END IF;

    -- Solo mode: assign to solo agent if enabled
    IF v_settings.solo_mode_enabled AND v_settings.solo_agent_id IS NOT NULL THEN
        -- Check solo agent isn't paused and hasn't hit cap
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

    -- Round Robin: pick the eligible agent assigned least recently
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
        -- Fallback to overflow recipient
        NEW.assigned_to := v_settings.overflow_recipient_id;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Create trigger on sales_leads for auto-assignment
DROP TRIGGER IF EXISTS trg_auto_assign_lead ON sales_leads;
CREATE TRIGGER trg_auto_assign_lead
    BEFORE INSERT ON sales_leads
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_lead_round_robin();

-- 4. Now assign existing unassigned leads to Jas and James in round-robin order
-- Jas King: 913a9a63-f3bc-4fbc-a105-3ef8dcbd6072
-- James Reed: 019299c4-4bb3-4cfc-b205-0d6cd4f64dd5
DO $$
DECLARE
    v_lead RECORD;
    v_agents UUID[] := ARRAY[
        '913a9a63-f3bc-4fbc-a105-3ef8dcbd6072'::UUID,  -- Jas (least recent)
        '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5'::UUID   -- James
    ];
    v_idx INT := 0;
    v_count INT := 0;
BEGIN
    FOR v_lead IN 
        SELECT id FROM sales_leads 
        WHERE assigned_to IS NULL 
          AND status NOT IN ('lost', 'fake_lead')
        ORDER BY created_at ASC
    LOOP
        UPDATE sales_leads 
        SET assigned_to = v_agents[(v_idx % 2) + 1], updated_at = now()
        WHERE id = v_lead.id;
        
        v_idx := v_idx + 1;
        v_count := v_count + 1;
    END LOOP;
    
    -- Update their assigned_today counts
    UPDATE agent_distribution_caps 
    SET assigned_today = (SELECT COUNT(*) FROM sales_leads WHERE assigned_to = '913a9a63-f3bc-4fbc-a105-3ef8dcbd6072' AND created_at >= CURRENT_DATE),
        last_assigned_at = now()
    WHERE admin_user_id = '913a9a63-f3bc-4fbc-a105-3ef8dcbd6072';
    
    UPDATE agent_distribution_caps 
    SET assigned_today = (SELECT COUNT(*) FROM sales_leads WHERE assigned_to = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5' AND created_at >= CURRENT_DATE),
        last_assigned_at = now()
    WHERE admin_user_id = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5';
    
    RAISE NOTICE 'Assigned % unassigned leads in round-robin to Jas and James', v_count;
END;
$$;
