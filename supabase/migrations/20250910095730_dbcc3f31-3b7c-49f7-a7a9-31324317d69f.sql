-- Create click fraud protection system
CREATE TABLE IF NOT EXISTS public.click_fraud_protection (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL,
  user_agent TEXT,
  session_id TEXT,
  action_type TEXT NOT NULL, -- 'quote_request', 'payment_click', 'form_submit', etc.
  click_count INTEGER NOT NULL DEFAULT 1,
  is_suspicious BOOLEAN NOT NULL DEFAULT false,
  risk_score INTEGER NOT NULL DEFAULT 0, -- 0-100 risk score
  blocked_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_click_fraud_ip_action ON public.click_fraud_protection(ip_address, action_type);
CREATE INDEX IF NOT EXISTS idx_click_fraud_created_at ON public.click_fraud_protection(created_at);
CREATE INDEX IF NOT EXISTS idx_click_fraud_suspicious ON public.click_fraud_protection(is_suspicious);

-- Create blocked IPs table
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL UNIQUE,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  reason TEXT NOT NULL,
  created_by TEXT DEFAULT 'system'
);

-- Create rate limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- IP or session_id
  action_type TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(identifier, action_type, window_start)
);

-- Enable RLS
ALTER TABLE public.click_fraud_protection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policies (admin only access)
CREATE POLICY "Admin can view click fraud protection" ON public.click_fraud_protection
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can manage blocked IPs" ON public.blocked_ips
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can view rate limits" ON public.rate_limits
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Create function to check if IP is blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(check_ip INET)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_ips 
    WHERE ip_address = check_ip 
    AND (blocked_until IS NULL OR blocked_until > now())
  );
END;
$$;

-- Create function to log suspicious activity
CREATE OR REPLACE FUNCTION public.log_click_activity(
  p_ip_address INET,
  p_user_agent TEXT,
  p_session_id TEXT,
  p_action_type TEXT,
  p_risk_score INTEGER DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_clicks INTEGER;
  is_blocked BOOLEAN;
BEGIN
  -- Check if IP is already blocked
  IF public.is_ip_blocked(p_ip_address) THEN
    RETURN FALSE;
  END IF;
  
  -- Count recent clicks from this IP for this action
  SELECT COUNT(*) INTO recent_clicks
  FROM public.click_fraud_protection
  WHERE ip_address = p_ip_address 
  AND action_type = p_action_type
  AND created_at > now() - INTERVAL '1 hour';
  
  -- Insert or update click record
  INSERT INTO public.click_fraud_protection (
    ip_address, user_agent, session_id, action_type, click_count, risk_score,
    is_suspicious
  ) VALUES (
    p_ip_address, p_user_agent, p_session_id, p_action_type, 1, p_risk_score,
    recent_clicks >= 10 OR p_risk_score > 70
  )
  ON CONFLICT ON CONSTRAINT click_fraud_protection_pkey
  DO UPDATE SET
    click_count = click_fraud_protection.click_count + 1,
    risk_score = GREATEST(click_fraud_protection.risk_score, p_risk_score),
    is_suspicious = recent_clicks >= 10 OR p_risk_score > 70,
    updated_at = now();
  
  -- Auto-block if too many suspicious clicks
  IF recent_clicks >= 20 THEN
    INSERT INTO public.blocked_ips (ip_address, reason, blocked_until)
    VALUES (p_ip_address, 'Automated blocking - excessive clicks', now() + INTERVAL '24 hours')
    ON CONFLICT (ip_address) DO NOTHING;
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_click_fraud_protection_updated_at
  BEFORE UPDATE ON public.click_fraud_protection
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();