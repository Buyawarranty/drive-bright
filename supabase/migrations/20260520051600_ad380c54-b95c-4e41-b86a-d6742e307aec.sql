
CREATE TABLE IF NOT EXISTS public.marketing_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_start date NOT NULL UNIQUE,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view marketing spend"
  ON public.marketing_spend FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin') AND au.is_active = true));

CREATE POLICY "Super admins can insert marketing spend"
  ON public.marketing_spend FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true));

CREATE POLICY "Super admins can update marketing spend"
  ON public.marketing_spend FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true));

CREATE POLICY "Super admins can delete marketing spend"
  ON public.marketing_spend FOR DELETE
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true));
