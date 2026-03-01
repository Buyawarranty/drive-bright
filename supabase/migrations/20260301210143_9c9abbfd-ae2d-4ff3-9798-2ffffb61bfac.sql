
-- 1. Create overflow_recipients table for multiple overflow people
CREATE TABLE IF NOT EXISTS public.overflow_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(admin_user_id)
);

-- Enable RLS
ALTER TABLE public.overflow_recipients ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read overflow_recipients" ON public.overflow_recipients
    FOR SELECT TO authenticated USING (true);

-- Allow admins/sales_leads to manage
CREATE POLICY "Allow admin manage overflow_recipients" ON public.overflow_recipients
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND au.role IN ('admin', 'super_admin', 'dev_tester', 'sales_lead')
            AND au.is_active = true
        )
    );

-- 2. Create overflow round-robin state
CREATE TABLE IF NOT EXISTS public.overflow_round_robin_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    last_assigned_overflow_id UUID REFERENCES public.overflow_recipients(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.overflow_round_robin_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read overflow_rr_state" ON public.overflow_round_robin_state
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin manage overflow_rr_state" ON public.overflow_round_robin_state
    FOR ALL TO authenticated USING (true);

-- Insert initial state row
INSERT INTO public.overflow_round_robin_state (id) VALUES (gen_random_uuid());

-- 3. Migrate existing overflow_recipient_id to new table if set
INSERT INTO public.overflow_recipients (admin_user_id, sort_order)
SELECT overflow_recipient_id, 0
FROM public.lead_distribution_settings
WHERE overflow_recipient_id IS NOT NULL
ON CONFLICT (admin_user_id) DO NOTHING;

-- 4. Update the auto_assign trigger to use strict round-robin + multi-overflow
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
    v_total_assigned_today INT;
    v_overflow_recipient RECORD;
    v_last_overflow_id UUID;
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

    -- Solo mode: assign to solo agent if enabled
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
        ELSE
            -- Try overflow recipients (round-robin among them)
            PERFORM assign_to_overflow_recipient(NEW);
        END IF;

        RETURN NEW;
    END IF;

    -- ==========================================
    -- ROUND ROBIN MODE (strict 1→2→3→1→2→3)
    -- ==========================================
    -- Get last assigned user from round_robin_state
    SELECT last_assigned_user_id INTO v_last_assigned_id 
    FROM round_robin_state LIMIT 1;

    -- Find the NEXT agent after the last assigned one (strict ordering by id)
    SELECT adc.* INTO v_next_agent
    FROM agent_distribution_caps adc
    JOIN admin_users au ON au.id = adc.admin_user_id
    WHERE au.is_active = true
      AND (adc.paused IS NULL OR adc.paused = false)
      AND au.role IN ('sales', 'sales_lead')
      AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
      AND (v_last_assigned_id IS NULL OR adc.admin_user_id > v_last_assigned_id)
    ORDER BY adc.admin_user_id ASC
    LIMIT 1;

    -- If no agent found after the last one, wrap around to the beginning
    IF v_next_agent IS NULL THEN
        SELECT adc.* INTO v_next_agent
        FROM agent_distribution_caps adc
        JOIN admin_users au ON au.id = adc.admin_user_id
        WHERE au.is_active = true
          AND (adc.paused IS NULL OR adc.paused = false)
          AND au.role IN ('sales', 'sales_lead')
          AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
        ORDER BY adc.admin_user_id ASC
        LIMIT 1;
    END IF;

    IF v_next_agent IS NOT NULL THEN
        NEW.assigned_to := v_next_agent.admin_user_id;
        
        -- Update agent cap
        UPDATE agent_distribution_caps 
        SET assigned_today = COALESCE(assigned_today, 0) + 1, last_assigned_at = v_now
        WHERE admin_user_id = v_next_agent.admin_user_id;

        -- Update round-robin state to track who was last assigned
        UPDATE round_robin_state 
        SET last_assigned_user_id = v_next_agent.admin_user_id, updated_at = v_now;
        
        IF NOT FOUND THEN
            INSERT INTO round_robin_state (last_assigned_user_id, updated_at)
            VALUES (v_next_agent.admin_user_id, v_now);
        END IF;
    ELSE
        -- All agents are at capacity → try overflow recipients (round-robin)
        SELECT last_assigned_overflow_id INTO v_last_overflow_id
        FROM overflow_round_robin_state LIMIT 1;

        -- Find next overflow recipient after the last one
        SELECT * INTO v_overflow_recipient
        FROM overflow_recipients
        WHERE is_active = true
          AND (v_last_overflow_id IS NULL OR id > v_last_overflow_id)
        ORDER BY sort_order ASC, id ASC
        LIMIT 1;

        -- Wrap around
        IF v_overflow_recipient IS NULL THEN
            SELECT * INTO v_overflow_recipient
            FROM overflow_recipients
            WHERE is_active = true
            ORDER BY sort_order ASC, id ASC
            LIMIT 1;
        END IF;

        IF v_overflow_recipient IS NOT NULL THEN
            NEW.assigned_to := v_overflow_recipient.admin_user_id;
            
            -- Update overflow round-robin state
            UPDATE overflow_round_robin_state
            SET last_assigned_overflow_id = v_overflow_recipient.id, updated_at = v_now;

            -- Track the assignment in agent caps too
            UPDATE agent_distribution_caps 
            SET assigned_today = COALESCE(assigned_today, 0) + 1, last_assigned_at = v_now
            WHERE admin_user_id = v_overflow_recipient.admin_user_id;
        END IF;
        -- If no overflow recipients either, lead stays unassigned
    END IF;

    RETURN NEW;
END;
$function$;

-- 5. Update claim_lead_for_agent to check overflow recipients table
CREATE OR REPLACE FUNCTION public.claim_lead_for_agent(p_lead_id uuid, p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_agent_cap RECORD;
    v_lead RECORD;
    v_agent_role text;
    v_settings RECORD;
    v_now timestamp with time zone := now();
    v_active_threshold timestamp with time zone := v_now - interval '90 seconds';
    v_is_online boolean;
    v_is_solo_agent boolean := false;
    v_is_overflow boolean := false;
BEGIN
    SELECT * INTO v_settings FROM lead_distribution_settings LIMIT 1;
    v_is_solo_agent := (v_settings.solo_mode_enabled AND v_settings.solo_agent_id = p_agent_id);
    
    SELECT role INTO v_agent_role FROM admin_users WHERE id = p_agent_id;
    
    IF v_agent_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agent not found.');
    END IF;
    
    IF v_agent_role = 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Administrators cannot claim leads.');
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM user_presence up
        WHERE up.admin_user_id = p_agent_id
          AND up.last_interaction_at >= v_active_threshold
    ) INTO v_is_online;
    
    IF NOT v_is_online THEN
        RETURN jsonb_build_object('success', false, 'error', 'You must be online to claim leads.');
    END IF;
    
    SELECT * INTO v_lead FROM sales_leads WHERE id = p_lead_id;
    IF v_lead IS NULL THEN
        SELECT * INTO v_lead FROM abandoned_carts WHERE id = p_lead_id;
        IF v_lead IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Lead not found.');
        END IF;
    END IF;
    
    SELECT * INTO v_agent_cap FROM agent_distribution_caps WHERE admin_user_id = p_agent_id;
    
    IF v_agent_cap IS NULL THEN
        INSERT INTO agent_distribution_caps (admin_user_id, daily_cap, assigned_today, paused)
        VALUES (p_agent_id, 20, 0, false)
        RETURNING * INTO v_agent_cap;
    END IF;
    
    IF v_agent_cap.paused = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Your lead receiving is currently paused.');
    END IF;

    -- Check if this agent is an overflow recipient (they bypass daily cap)
    SELECT EXISTS (
        SELECT 1 FROM overflow_recipients WHERE admin_user_id = p_agent_id AND is_active = true
    ) INTO v_is_overflow;
    
    IF NOT v_is_solo_agent AND NOT v_is_overflow THEN
        IF v_agent_cap.daily_cap IS NOT NULL AND v_agent_cap.assigned_today >= v_agent_cap.daily_cap THEN
            RETURN jsonb_build_object('success', false, 'error', 'You have reached your daily lead cap.');
        END IF;
    END IF;
    
    UPDATE sales_leads 
    SET assigned_to = p_agent_id, updated_at = v_now
    WHERE id = p_lead_id;
    
    UPDATE agent_distribution_caps 
    SET assigned_today = assigned_today + 1, last_assigned_at = v_now
    WHERE admin_user_id = p_agent_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Lead successfully claimed!');
END;
$function$;

-- 6. Update delete cascade to handle overflow_recipients
CREATE OR REPLACE FUNCTION public.delete_admin_user_cascade(p_admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE customers SET assigned_to = NULL WHERE assigned_to = p_admin_user_id;
  UPDATE customers SET quote_sent_by = NULL WHERE quote_sent_by = p_admin_user_id;
  UPDATE customers SET payment_confirmed_by = NULL WHERE payment_confirmed_by = p_admin_user_id;
  UPDATE sales_leads SET assigned_to = NULL WHERE assigned_to = p_admin_user_id;
  UPDATE lead_distribution_settings SET overflow_recipient_id = NULL WHERE overflow_recipient_id = p_admin_user_id;
  UPDATE lead_distribution_settings SET solo_agent_id = NULL WHERE solo_agent_id = p_admin_user_id;
  UPDATE round_robin_state SET last_assigned_user_id = NULL WHERE last_assigned_user_id = p_admin_user_id;
  UPDATE commission_records SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE deal_records SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE user_activity_log SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE staff_timesheets SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE lead_call_logs SET agent_id = NULL WHERE agent_id = p_admin_user_id;
  UPDATE selling_tips SET created_by = NULL WHERE created_by = p_admin_user_id;
  UPDATE selling_tips SET resolved_by = NULL WHERE resolved_by = p_admin_user_id;

  DELETE FROM overflow_recipients WHERE admin_user_id = p_admin_user_id;
  DELETE FROM structured_customer_notes WHERE created_by = p_admin_user_id;
  DELETE FROM structured_customer_notes WHERE updated_by = p_admin_user_id;
  DELETE FROM lead_tag_assignments WHERE assigned_by = p_admin_user_id;
  DELETE FROM lead_activities WHERE performed_by = p_admin_user_id;
  DELETE FROM lead_quick_notes WHERE created_by = p_admin_user_id;
  DELETE FROM lead_assignment_audit WHERE assigned_to_id = p_admin_user_id;
  DELETE FROM salesperson_stats WHERE user_id = p_admin_user_id;
  DELETE FROM user_badges WHERE user_id = p_admin_user_id;
  DELETE FROM user_daily_online_time WHERE admin_user_id = p_admin_user_id;
  
  DELETE FROM agent_distribution_caps WHERE admin_user_id = p_admin_user_id;
  DELETE FROM agent_daily_targets WHERE agent_id = p_admin_user_id;
  DELETE FROM user_presence WHERE admin_user_id = p_admin_user_id;
  DELETE FROM sales_targets WHERE admin_user_id = p_admin_user_id;

  DELETE FROM admin_users WHERE id = p_admin_user_id;
END;
$function$;
