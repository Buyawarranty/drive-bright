-- Fix search_path for the analytics function
CREATE OR REPLACE FUNCTION public.update_campaign_analytics(p_campaign_id UUID)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_sent INTEGER; v_total_delivered INTEGER; v_total_opened INTEGER;
  v_total_clicked INTEGER; v_total_bounced INTEGER; v_total_failed INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE delivery_status IN ('sent', 'delivered', 'opened', 'clicked')),
    COUNT(*) FILTER (WHERE delivery_status IN ('delivered', 'opened', 'clicked')),
    COUNT(*) FILTER (WHERE delivery_status IN ('opened', 'clicked')),
    COUNT(*) FILTER (WHERE delivery_status = 'clicked'),
    COUNT(*) FILTER (WHERE delivery_status = 'bounced'),
    COUNT(*) FILTER (WHERE delivery_status = 'failed')
  INTO v_total_sent, v_total_delivered, v_total_opened, v_total_clicked, v_total_bounced, v_total_failed
  FROM public.email_logs WHERE campaign_id = p_campaign_id;
  
  INSERT INTO public.campaign_analytics (campaign_id, total_sent, total_delivered, total_opened, total_clicked, total_bounced, total_failed, open_rate, click_rate, bounce_rate, last_calculated_at)
  VALUES (p_campaign_id, v_total_sent, v_total_delivered, v_total_opened, v_total_clicked, v_total_bounced, v_total_failed,
    CASE WHEN v_total_delivered > 0 THEN (v_total_opened::NUMERIC / v_total_delivered * 100)::NUMERIC(5,2) ELSE 0 END,
    CASE WHEN v_total_delivered > 0 THEN (v_total_clicked::NUMERIC / v_total_delivered * 100)::NUMERIC(5,2) ELSE 0 END,
    CASE WHEN v_total_sent > 0 THEN (v_total_bounced::NUMERIC / v_total_sent * 100)::NUMERIC(5,2) ELSE 0 END, now())
  ON CONFLICT (campaign_id) DO UPDATE SET
    total_sent = EXCLUDED.total_sent, total_delivered = EXCLUDED.total_delivered, total_opened = EXCLUDED.total_opened,
    total_clicked = EXCLUDED.total_clicked, total_bounced = EXCLUDED.total_bounced, total_failed = EXCLUDED.total_failed,
    open_rate = EXCLUDED.open_rate, click_rate = EXCLUDED.click_rate, bounce_rate = EXCLUDED.bounce_rate, last_calculated_at = EXCLUDED.last_calculated_at;
END;
$$;