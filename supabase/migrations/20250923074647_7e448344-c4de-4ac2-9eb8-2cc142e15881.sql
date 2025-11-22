-- Update the log_click_activity function to be more lenient for purchase actions
CREATE OR REPLACE FUNCTION public.log_click_activity(p_ip_address inet, p_user_agent text, p_session_id text, p_action_type text, p_risk_score integer DEFAULT 0)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  recent_clicks INTEGER;
  is_blocked BOOLEAN;
  click_threshold INTEGER;
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
  
  -- Set different thresholds based on action type
  IF p_action_type = 'complete_purchase' THEN
    click_threshold := 100; -- Very lenient for purchase completion
  ELSE
    click_threshold := 10; -- Normal threshold for other actions
  END IF;
  
  -- Insert or update click record
  INSERT INTO public.click_fraud_protection (
    ip_address, user_agent, session_id, action_type, click_count, risk_score,
    is_suspicious
  ) VALUES (
    p_ip_address, p_user_agent, p_session_id, p_action_type, 1, p_risk_score,
    recent_clicks >= click_threshold OR p_risk_score > 70
  )
  ON CONFLICT ON CONSTRAINT click_fraud_protection_pkey
  DO UPDATE SET
    click_count = click_fraud_protection.click_count + 1,
    risk_score = GREATEST(click_fraud_protection.risk_score, p_risk_score),
    is_suspicious = recent_clicks >= click_threshold OR p_risk_score > 70,
    updated_at = now();
  
  -- Only auto-block for extremely suspicious activity
  -- For purchase actions, use much higher threshold (200 clicks)
  -- For other actions, use normal threshold (50 clicks)
  IF (p_action_type = 'complete_purchase' AND recent_clicks >= 200) OR 
     (p_action_type != 'complete_purchase' AND recent_clicks >= 50) THEN
    INSERT INTO public.blocked_ips (ip_address, reason, blocked_until)
    VALUES (p_ip_address, 'Automated blocking - excessive clicks', now() + INTERVAL '24 hours')
    ON CONFLICT (ip_address) DO NOTHING;
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$function$;