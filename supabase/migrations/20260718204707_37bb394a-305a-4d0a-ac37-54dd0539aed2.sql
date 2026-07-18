
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'dormant';

ALTER TABLE public.lead_distribution_settings
  ADD COLUMN IF NOT EXISTS open_round_robin_enabled boolean NOT NULL DEFAULT false;

UPDATE public.lead_distribution_settings
SET open_round_robin_enabled = true
WHERE team_id = '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';

INSERT INTO public.lead_distribution_settings (team_id, open_round_robin_enabled)
SELECT '14f567b3-4ba3-4baa-acef-8d0de8e24b2d', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_distribution_settings
  WHERE team_id = '14f567b3-4ba3-4baa-acef-8d0de8e24b2d'
);

ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS orr_first_call_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS orr_retry_deadline      timestamptz,
  ADD COLUMN IF NOT EXISTS orr_reassign_count      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orr_dormant_at          timestamptz;

CREATE INDEX IF NOT EXISTS idx_sales_leads_orr_deadline
  ON public.sales_leads (orr_first_call_deadline)
  WHERE orr_first_call_deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_leads_orr_retry
  ON public.sales_leads (orr_retry_deadline)
  WHERE orr_retry_deadline IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_agent_on_team_blue(_agent uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lead_team_members
    WHERE admin_user_id = _agent
      AND team_id = '14f567b3-4ba3-4baa-acef-8d0de8e24b2d'
  );
$$;

CREATE OR REPLACE FUNCTION public.orr_set_first_call_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
     AND public.is_agent_on_team_blue(NEW.assigned_to)
  THEN
    NEW.orr_first_call_deadline := now() + interval '2 minutes';
    NEW.orr_retry_deadline      := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orr_set_first_call_deadline ON public.sales_leads;
CREATE TRIGGER trg_orr_set_first_call_deadline
BEFORE INSERT OR UPDATE OF assigned_to ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.orr_set_first_call_deadline();
