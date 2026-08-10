ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'unsubscribed';

CREATE TABLE IF NOT EXISTS public.erased_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  customer_name text,
  reason text,
  status text NOT NULL DEFAULT 'unsubscribed',
  lead_ids uuid[] NOT NULL DEFAULT '{}',
  leads_archive jsonb NOT NULL DEFAULT '[]'::jsonb,
  customers_archive jsonb NOT NULL DEFAULT '[]'::jsonb,
  other_archive jsonb NOT NULL DEFAULT '{}'::jsonb,
  erased_by uuid,
  erased_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erased_customers TO authenticated;
GRANT ALL ON public.erased_customers TO service_role;

ALTER TABLE public.erased_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view erased customers"
ON public.erased_customers FOR SELECT TO authenticated
USING (public.is_management(auth.uid()));

CREATE POLICY "Management can manage erased customers"
ON public.erased_customers FOR ALL TO authenticated
USING (public.is_management(auth.uid()))
WITH CHECK (public.is_management(auth.uid()));

CREATE TRIGGER update_erased_customers_updated_at
BEFORE UPDATE ON public.erased_customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_erased_customers_email ON public.erased_customers (lower(email));
CREATE INDEX IF NOT EXISTS idx_erased_customers_created_at ON public.erased_customers (created_at DESC);