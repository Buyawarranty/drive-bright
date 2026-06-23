CREATE TABLE public.sales_lead_team_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.lead_teams(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, team_id)
);

CREATE INDEX idx_sltv_admin ON public.sales_lead_team_visibility(admin_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_lead_team_visibility TO authenticated;
GRANT ALL ON public.sales_lead_team_visibility TO service_role;

ALTER TABLE public.sales_lead_team_visibility ENABLE ROW LEVEL SECURITY;

-- Sales lead can see their own grants
CREATE POLICY "Sales lead can view own team visibility"
ON public.sales_lead_team_visibility
FOR SELECT
TO authenticated
USING (
  admin_user_id IN (
    SELECT id FROM public.admin_users WHERE user_id = auth.uid()
  )
);

-- Management can view all grants
CREATE POLICY "Management can view all team visibility"
ON public.sales_lead_team_visibility
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'sales_manager')
      AND is_active = true
  )
);

-- Management can insert/update/delete grants
CREATE POLICY "Management can manage team visibility"
ON public.sales_lead_team_visibility
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'sales_manager')
      AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'sales_manager')
      AND is_active = true
  )
);