CREATE TABLE public.pricing_vehicle_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle text NOT NULL,
  min_one_year numeric NULL,
  treatment text NOT NULL DEFAULT 'Premium floor',
  covered boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_by uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pricing_vehicle_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_vehicle_rules TO authenticated;
GRANT ALL ON public.pricing_vehicle_rules TO service_role;

ALTER TABLE public.pricing_vehicle_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vehicle pricing rules"
ON public.pricing_vehicle_rules FOR SELECT
USING (true);

CREATE POLICY "Management can manage vehicle pricing rules"
ON public.pricing_vehicle_rules FOR ALL
TO authenticated
USING (public.is_management(auth.uid()))
WITH CHECK (public.is_management(auth.uid()));

CREATE TRIGGER trg_pricing_vehicle_rules_updated_at
BEFORE UPDATE ON public.pricing_vehicle_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();