-- Lead Distribution Settings (system-wide)
CREATE TABLE public.lead_distribution_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    active_only_distribution BOOLEAN DEFAULT true,
    overflow_recipient_id UUID REFERENCES public.admin_users(id),
    solo_agent_id UUID REFERENCES public.admin_users(id), -- For "give all leads to 1 agent" mode
    solo_mode_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default settings row
INSERT INTO public.lead_distribution_settings (id) VALUES (gen_random_uuid());

-- Agent Distribution Caps (per-agent settings)
CREATE TABLE public.agent_distribution_caps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    daily_cap INTEGER DEFAULT 20,
    assigned_today INTEGER DEFAULT 0,
    last_assigned_at TIMESTAMP WITH TIME ZONE,
    paused BOOLEAN DEFAULT false,
    cap_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(admin_user_id)
);

-- Enhanced Agent Presence (extends existing presence with interaction tracking)
ALTER TABLE public.user_presence 
ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_paused_receiving BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS visibility_state TEXT DEFAULT 'visible';

-- Lead Assignment Audit Trail
CREATE TABLE public.lead_assignment_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL,
    assigned_to_id UUID REFERENCES public.admin_users(id),
    assigned_by TEXT, -- 'system' for auto-assign, agent email for manual
    assignment_type TEXT NOT NULL, -- 'round_robin', 'overflow', 'manual', 'claim'
    reason TEXT, -- Why this agent was selected
    agent_cap_at_time INTEGER,
    agent_assigned_today_at_time INTEGER,
    agent_presence_status TEXT,
    eligible_agents_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for fast queries
CREATE INDEX idx_lead_assignment_audit_lead_id ON public.lead_assignment_audit(lead_id);
CREATE INDEX idx_lead_assignment_audit_assigned_to ON public.lead_assignment_audit(assigned_to_id);
CREATE INDEX idx_lead_assignment_audit_created ON public.lead_assignment_audit(created_at DESC);
CREATE INDEX idx_agent_caps_admin_user ON public.agent_distribution_caps(admin_user_id);

-- Function to reset daily caps at midnight
CREATE OR REPLACE FUNCTION public.reset_daily_caps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE agent_distribution_caps
    SET assigned_today = 0,
        cap_reset_date = CURRENT_DATE,
        updated_at = now()
    WHERE cap_reset_date < CURRENT_DATE;
END;
$$;

-- Function to get next eligible agent for round-robin
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
    
    -- Solo mode: return the solo agent if enabled
    IF v_settings.solo_mode_enabled AND v_settings.solo_agent_id IS NOT NULL THEN
        RETURN v_settings.solo_agent_id;
    END IF;
    
    -- Find eligible agent: active, not paused, under cap
    SELECT adc.admin_user_id INTO v_next_agent_id
    FROM agent_distribution_caps adc
    INNER JOIN admin_users au ON au.id = adc.admin_user_id
    LEFT JOIN user_presence up ON up.admin_user_id = adc.admin_user_id
    WHERE au.is_active = true
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
    
    -- If no eligible agent found, try overflow recipient
    IF v_next_agent_id IS NULL AND v_settings.overflow_recipient_id IS NOT NULL THEN
        -- Check if overflow recipient is available (ignore cap for overflow)
        SELECT adc.admin_user_id INTO v_next_agent_id
        FROM agent_distribution_caps adc
        INNER JOIN admin_users au ON au.id = adc.admin_user_id
        LEFT JOIN user_presence up ON up.admin_user_id = adc.admin_user_id
        WHERE adc.admin_user_id = v_settings.overflow_recipient_id
            AND au.is_active = true
            AND COALESCE(adc.paused, false) = false
            AND (
                v_settings.active_only_distribution = false
                OR up.status = 'online'
            );
    END IF;
    
    RETURN v_next_agent_id;
END;
$$;

-- Function to claim a lead (with race condition prevention)
CREATE OR REPLACE FUNCTION public.claim_lead_for_agent(
    p_lead_id UUID,
    p_agent_id UUID
)
RETURNS JSONB
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
    
    IF v_settings.active_only_distribution 
       AND (v_presence IS NULL OR v_presence.status != 'online' 
            OR v_presence.last_interaction_at < now() - INTERVAL '90 seconds') THEN
        RETURN jsonb_build_object('success', false, 'error', 'You must be Active to claim leads. Interact with the page.');
    END IF;
    
    -- Attempt to assign the lead (only if currently unassigned)
    UPDATE sales_leads
    SET assigned_to = (SELECT user_id FROM admin_users WHERE id = p_agent_id),
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

-- Function to update agent interaction (for presence tracking)
CREATE OR REPLACE FUNCTION public.log_agent_interaction(
    p_event_type TEXT DEFAULT 'activity'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_admin_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Get admin_user_id
    SELECT id INTO v_admin_user_id FROM admin_users WHERE user_id = v_user_id;
    
    IF v_admin_user_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Update presence with interaction
    UPDATE user_presence
    SET last_interaction_at = now(),
        interaction_count = COALESCE(interaction_count, 0) + 1,
        status = 'online',
        last_seen_at = now(),
        updated_at = now()
    WHERE user_id = v_user_id;
END;
$$;

-- Enable RLS
ALTER TABLE public.lead_distribution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_distribution_caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_distribution_settings
CREATE POLICY "Admins can view distribution settings"
ON public.lead_distribution_settings FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update distribution settings"
ON public.lead_distribution_settings FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS Policies for agent_distribution_caps
CREATE POLICY "Admins can view all caps"
ON public.agent_distribution_caps FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own caps"
ON public.agent_distribution_caps FOR SELECT
TO authenticated
USING (admin_user_id = (SELECT id FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage caps"
ON public.agent_distribution_caps FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS Policies for lead_assignment_audit
CREATE POLICY "Admins can view audit"
ON public.lead_assignment_audit FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert audit"
ON public.lead_assignment_audit FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));