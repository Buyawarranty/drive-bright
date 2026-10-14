CREATE TABLE public.sale_authorisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL UNIQUE,
  agent_admin_id uuid,
  customer_name text,
  warranty_number text,
  paid_amount numeric,
  status text NOT NULL CHECK (status IN ('approved','declined')),
  decided_by uuid,
  decided_by_name text,
  agent_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sale_authorisations TO authenticated;
GRANT ALL ON public.sale_authorisations TO service_role;
ALTER TABLE public.sale_authorisations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Management manage sale authorisations" ON public.sale_authorisations FOR ALL TO authenticated
  USING (public.is_management((select auth.uid()))) WITH CHECK (public.is_management((select auth.uid())));
CREATE POLICY "Agent reads own sale authorisations" ON public.sale_authorisations FOR SELECT TO authenticated
  USING (agent_admin_id = public.current_admin_user_id());
CREATE POLICY "Agent marks own as seen" ON public.sale_authorisations FOR UPDATE TO authenticated
  USING (agent_admin_id = public.current_admin_user_id()) WITH CHECK (agent_admin_id = public.current_admin_user_id());
CREATE TRIGGER sale_authorisations_updated_at BEFORE UPDATE ON public.sale_authorisations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();