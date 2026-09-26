CREATE TABLE public.claim_court_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type text NOT NULL DEFAULT 'small_claims',
  registration text NOT NULL,
  customer_name text,
  case_reference text,
  claim_file_url text,
  claim_id uuid,
  paperwork_deadline date,
  hearing_date date,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_court_cases TO authenticated;
GRANT ALL ON public.claim_court_cases TO service_role;
ALTER TABLE public.claim_court_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage court cases" ON public.claim_court_cases FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE OR REPLACE FUNCTION public.claim_court_cases_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER claim_court_cases_touch BEFORE UPDATE ON public.claim_court_cases FOR EACH ROW EXECUTE FUNCTION public.claim_court_cases_touch();