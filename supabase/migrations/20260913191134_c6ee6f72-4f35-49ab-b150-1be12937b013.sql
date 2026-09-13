DROP TRIGGER IF EXISTS trg_flag_fake_test_phone_lead ON public.sales_leads;

CREATE OR REPLACE FUNCTION public.is_known_fake_phone(_phone text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT false
$$;

CREATE OR REPLACE FUNCTION public.flag_fake_test_phone_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NULL;
END;
$$;