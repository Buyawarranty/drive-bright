CREATE TABLE IF NOT EXISTS public.save_online_sale_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  commission_pct numeric NOT NULL DEFAULT 4,
  authorised_by uuid,
  authorised_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.save_online_sale_agents TO authenticated;
GRANT ALL ON public.save_online_sale_agents TO service_role;

ALTER TABLE public.save_online_sale_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view save online sale permissions"
  ON public.save_online_sale_agents FOR SELECT TO authenticated
  USING (public.is_active_admin_user((select auth.uid())));

CREATE POLICY "Lead routing managers manage save online sale permissions"
  ON public.save_online_sale_agents FOR ALL TO authenticated
  USING (public.can_manage_lead_routing((select auth.uid())))
  WITH CHECK (public.can_manage_lead_routing((select auth.uid())));

CREATE TRIGGER trg_save_online_sale_agents_updated_at
  BEFORE UPDATE ON public.save_online_sale_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS save_online_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS save_commission_pct numeric,
  ADD COLUMN IF NOT EXISTS save_sale_value numeric;