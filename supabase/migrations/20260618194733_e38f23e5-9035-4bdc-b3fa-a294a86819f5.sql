
CREATE TABLE IF NOT EXISTS public.renewal_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_days integer NOT NULL UNIQUE,
  label text NOT NULL,
  template_key text NOT NULL,
  discount_percent integer NOT NULL DEFAULT 0,
  auto_assign_agent boolean NOT NULL DEFAULT false,
  send_sms boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT renewal_offers_discount_cap CHECK (discount_percent BETWEEN 0 AND 25)
);
GRANT SELECT ON public.renewal_offers TO authenticated;
GRANT ALL ON public.renewal_offers TO service_role;
ALTER TABLE public.renewal_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "renewal_offers_view_authenticated"
  ON public.renewal_offers FOR SELECT TO authenticated USING (true);

CREATE POLICY "renewal_offers_manage_admins"
  ON public.renewal_offers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
                  AND au.is_active = true
                  AND au.role IN ('admin'::user_role,'super_admin'::user_role,'sales_lead'::user_role,'sales_manager'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
                  AND au.is_active = true
                  AND au.role IN ('admin'::user_role,'super_admin'::user_role,'sales_lead'::user_role,'sales_manager'::user_role)));

INSERT INTO public.renewal_offers (milestone_days, label, template_key, discount_percent, auto_assign_agent, send_sms, sort_order)
VALUES
  (90,  'Heads-up (90 days)',        'renewal_90_heads_up',     0,  false, false, 10),
  (60,  'Early-bird (60 days)',      'renewal_60_early_bird',   10, false, true,  20),
  (30,  'Push (30 days)',            'renewal_30_push',         15, true,  false, 30),
  (14,  'Urgency (14 days)',         'renewal_14_urgency',      20, true,  true,  40),
  (7,   'Last chance (7 days)',      'renewal_7_last_chance',   20, true,  true,  50),
  (0,   'Expires today',             'renewal_0_today',         20, false, false, 60),
  (-7,  'Win-back (7 days lapsed)',  'renewal_lapsed_7',        25, false, false, 70),
  (-30, 'Win-back (30 days lapsed)', 'renewal_lapsed_30',       25, false, false, 80)
ON CONFLICT (milestone_days) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.renewal_campaign_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.customer_policies(id) ON DELETE CASCADE,
  customer_id uuid,
  milestone_days integer NOT NULL,
  template_key text NOT NULL,
  discount_code_id uuid,
  discount_code text,
  discount_percent integer,
  assigned_agent_id uuid,
  scheduled_email_id uuid,
  email_log_id uuid,
  recipient_email text,
  status text NOT NULL DEFAULT 'queued',
  scheduled_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  skip_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_id, milestone_days)
);
CREATE INDEX IF NOT EXISTS idx_renewal_campaign_log_policy ON public.renewal_campaign_log(policy_id);
CREATE INDEX IF NOT EXISTS idx_renewal_campaign_log_status ON public.renewal_campaign_log(status);
CREATE INDEX IF NOT EXISTS idx_renewal_campaign_log_milestone ON public.renewal_campaign_log(milestone_days);

GRANT SELECT ON public.renewal_campaign_log TO authenticated;
GRANT ALL ON public.renewal_campaign_log TO service_role;
ALTER TABLE public.renewal_campaign_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "renewal_campaign_log_view_sales"
  ON public.renewal_campaign_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
                  AND au.is_active = true
                  AND au.role IN ('admin'::user_role,'super_admin'::user_role,'sales_lead'::user_role,'sales'::user_role,'sales_manager'::user_role,'performance_manager'::user_role)));

CREATE POLICY "renewal_campaign_log_manage_admins"
  ON public.renewal_campaign_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
                  AND au.is_active = true
                  AND au.role IN ('admin'::user_role,'super_admin'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
                  AND au.is_active = true
                  AND au.role IN ('admin'::user_role,'super_admin'::user_role)));

DROP TRIGGER IF EXISTS trg_renewal_offers_updated ON public.renewal_offers;
CREATE TRIGGER trg_renewal_offers_updated BEFORE UPDATE ON public.renewal_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_renewal_campaign_log_updated ON public.renewal_campaign_log;
CREATE TRIGGER trg_renewal_campaign_log_updated BEFORE UPDATE ON public.renewal_campaign_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
