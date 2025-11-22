-- Create email campaigns table first
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  from_email TEXT NOT NULL DEFAULT 'marketing@buyawarranty.co.uk',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled')),
  campaign_type TEXT NOT NULL DEFAULT 'marketing' CHECK (campaign_type IN ('marketing', 'transactional', 'automated', 'ab_test')),
  segment_filters JSONB DEFAULT '{}',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  is_ab_test BOOLEAN DEFAULT false,
  ab_variant TEXT,
  ab_test_parent_id UUID REFERENCES public.email_campaigns(id)
);

-- Now add campaign_id column to email_logs
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'email_logs' 
                 AND column_name = 'campaign_id') THEN
    ALTER TABLE public.email_logs ADD COLUMN campaign_id UUID REFERENCES public.email_campaigns(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.subscriber_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.subscriber_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  tag TEXT NOT NULL,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email, tag)
);

CREATE TABLE IF NOT EXISTS public.email_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  consent_given BOOLEAN DEFAULT true,
  consent_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  unsubscribe_reason TEXT,
  double_opt_in BOOLEAN DEFAULT false,
  source TEXT,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.email_campaigns(id) NOT NULL,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,
  total_complained INTEGER DEFAULT 0,
  open_rate NUMERIC(5,2) DEFAULT 0,
  click_rate NUMERIC(5,2) DEFAULT 0,
  bounce_rate NUMERIC(5,2) DEFAULT 0,
  unsubscribe_rate NUMERIC(5,2) DEFAULT 0,
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id)
);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriber_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriber_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_analytics ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Admins can manage campaigns" ON public.email_campaigns;
DROP POLICY IF EXISTS "Service role can manage campaigns" ON public.email_campaigns;
DROP POLICY IF EXISTS "Admins can manage segments" ON public.subscriber_segments;
DROP POLICY IF EXISTS "Admins can manage tags" ON public.subscriber_tags;
DROP POLICY IF EXISTS "Admins can view consents" ON public.email_consents;
DROP POLICY IF EXISTS "Service role can manage consents" ON public.email_consents;
DROP POLICY IF EXISTS "Anyone can unsubscribe" ON public.email_consents;
DROP POLICY IF EXISTS "Admins can view analytics" ON public.campaign_analytics;
DROP POLICY IF EXISTS "Service role can manage analytics" ON public.campaign_analytics;

CREATE POLICY "Admins can manage campaigns" ON public.email_campaigns FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Service role can manage campaigns" ON public.email_campaigns FOR ALL USING (true);
CREATE POLICY "Admins can manage segments" ON public.subscriber_segments FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage tags" ON public.subscriber_tags FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Admins can view consents" ON public.email_consents FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Service role can manage consents" ON public.email_consents FOR ALL USING (true);
CREATE POLICY "Anyone can unsubscribe" ON public.email_consents FOR UPDATE USING (true) WITH CHECK (unsubscribed_at IS NOT NULL);
CREATE POLICY "Admins can view analytics" ON public.campaign_analytics FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Service role can manage analytics" ON public.campaign_analytics FOR ALL USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON public.email_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_subscriber_tags_email ON public.subscriber_tags(email);
CREATE INDEX IF NOT EXISTS idx_email_consents_email ON public.email_consents(email);

-- Analytics function
CREATE OR REPLACE FUNCTION public.update_campaign_analytics(p_campaign_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
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