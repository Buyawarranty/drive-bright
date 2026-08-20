CREATE TABLE IF NOT EXISTS public.agent_review_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('positive','negative_removed')),
  customer_name text,
  channel text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_review_claims_agent_week ON public.agent_review_claims(admin_user_id, week_start);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_review_claims TO authenticated;
GRANT ALL ON public.agent_review_claims TO service_role;

ALTER TABLE public.agent_review_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents manage own review claims" ON public.agent_review_claims;
CREATE POLICY "agents manage own review claims"
ON public.agent_review_claims FOR ALL TO authenticated
USING (admin_user_id = public.current_admin_user_id() OR public.is_admin(auth.uid()))
WITH CHECK (admin_user_id = public.current_admin_user_id());
