-- Create lead_call_logs table for detailed call attempt tracking
CREATE TABLE IF NOT EXISTS public.lead_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL, -- Can be UUID or 'cart_' prefixed ID
  lead_type TEXT NOT NULL DEFAULT 'sales_lead', -- 'sales_lead' or 'abandoned_cart'
  attempt_number INTEGER NOT NULL,
  agent_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  agent_name TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('no_answer', 'voicemail', 'connected', 'wrong_number', 'busy', 'callback_scheduled')),
  notes TEXT,
  next_follow_up_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient lead lookups
CREATE INDEX idx_lead_call_logs_lead_id ON public.lead_call_logs(lead_id);
CREATE INDEX idx_lead_call_logs_agent_id ON public.lead_call_logs(agent_id);
CREATE INDEX idx_lead_call_logs_created_at ON public.lead_call_logs(created_at);
CREATE INDEX idx_lead_call_logs_outcome ON public.lead_call_logs(outcome);

-- Create lead_settings table for configurable max call attempts
CREATE TABLE IF NOT EXISTS public.lead_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default max_call_attempts setting
INSERT INTO public.lead_settings (setting_key, setting_value, description)
VALUES ('max_call_attempts', '3', 'Maximum number of call attempts before requiring status change')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert follow-up intervals setting
INSERT INTO public.lead_settings (setting_key, setting_value, description)
VALUES ('call_follow_up_intervals', '{"1": 24, "2": 48, "3": 72}', 'Hours to wait before next call attempt based on attempt number')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.lead_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_call_logs - allow authenticated admin users
CREATE POLICY "Admin users can view call logs"
ON public.lead_call_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

CREATE POLICY "Admin users can insert call logs"
ON public.lead_call_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

CREATE POLICY "Admin users can update call logs"
ON public.lead_call_logs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

-- RLS policies for lead_settings
CREATE POLICY "Admin users can view settings"
ON public.lead_settings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

CREATE POLICY "Only admins can update settings"
ON public.lead_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Add comments
COMMENT ON TABLE public.lead_call_logs IS 'Tracks individual call attempts with outcomes for lead management';
COMMENT ON TABLE public.lead_settings IS 'Configurable settings for lead management including max call attempts';
COMMENT ON COLUMN public.lead_call_logs.lead_id IS 'Reference to sales_leads.id or cart_ prefixed abandoned_carts.id';
COMMENT ON COLUMN public.lead_call_logs.outcome IS 'Result of the call attempt';