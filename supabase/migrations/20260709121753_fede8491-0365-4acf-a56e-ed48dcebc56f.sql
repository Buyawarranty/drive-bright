
CREATE TABLE IF NOT EXISTS public.recontact_agent_caps (
  admin_user_id uuid PRIMARY KEY REFERENCES public.admin_users(id) ON DELETE CASCADE,
  daily_cap integer,
  total_cap integer,
  blocked boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recontact_agent_caps TO authenticated;
GRANT ALL ON public.recontact_agent_caps TO service_role;

ALTER TABLE public.recontact_agent_caps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Management manage recontact caps" ON public.recontact_agent_caps;
CREATE POLICY "Management manage recontact caps"
  ON public.recontact_agent_caps FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid() AND au.role::text IN ('admin','super_admin','sales_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid() AND au.role::text IN ('admin','super_admin','sales_manager')));

DROP POLICY IF EXISTS "Agents read own recontact cap" ON public.recontact_agent_caps;
CREATE POLICY "Agents read own recontact cap"
  ON public.recontact_agent_caps FOR SELECT
  TO authenticated
  USING (admin_user_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.set_recontact_agent_caps_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_recontact_agent_caps_updated_at ON public.recontact_agent_caps;
CREATE TRIGGER trg_recontact_agent_caps_updated_at
  BEFORE UPDATE ON public.recontact_agent_caps
  FOR EACH ROW EXECUTE FUNCTION public.set_recontact_agent_caps_updated_at();

CREATE OR REPLACE FUNCTION public.recontact_agent_stats()
RETURNS TABLE (
  admin_user_id uuid,
  taken_today bigint,
  taken_total bigint,
  last_taken_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH audit AS (
    SELECT
      COALESCE(
        (SELECT au.id FROM public.admin_users au WHERE au.user_id::text = a.assigned_by LIMIT 1),
        (SELECT au.id FROM public.admin_users au WHERE au.id::text = a.assigned_by LIMIT 1)
      ) AS admin_user_id,
      a.created_at
    FROM public.lead_assignment_audit a
    WHERE a.assignment_type IN ('recontact_bulk_claim', 'recontact_auto_take', 'recontact_manual')
  )
  SELECT admin_user_id,
    COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS taken_today,
    COUNT(*) AS taken_total,
    MAX(created_at) AS last_taken_at
  FROM audit
  WHERE admin_user_id IS NOT NULL
  GROUP BY admin_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.recontact_agent_stats() TO authenticated;
