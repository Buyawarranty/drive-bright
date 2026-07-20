CREATE OR REPLACE FUNCTION public.auto_tag_ni_vehicle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag_id uuid;
  v_reg text;
BEGIN
  v_reg := upper(regexp_replace(coalesce(NEW.vehicle_reg, ''), '\s', '', 'g'));

  IF v_reg ~ '^[A-Z]{3}[0-9]{1,4}$' AND substring(v_reg from 1 for 3) ~ '[IZ]' THEN
    SELECT id INTO v_tag_id FROM public.lead_tags WHERE name = 'VERIFY vehicle' LIMIT 1;
    IF v_tag_id IS NOT NULL THEN
      INSERT INTO public.lead_tag_assignments (lead_id, tag_id)
      VALUES (NEW.id, v_tag_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_tag_ni_vehicle ON public.sales_leads;
CREATE TRIGGER trg_auto_tag_ni_vehicle
AFTER INSERT ON public.sales_leads
FOR EACH ROW
EXECUTE FUNCTION public.auto_tag_ni_vehicle();

INSERT INTO public.lead_tag_assignments (lead_id, tag_id)
SELECT sl.id, (SELECT id FROM public.lead_tags WHERE name = 'VERIFY vehicle' LIMIT 1)
FROM public.sales_leads sl
WHERE upper(regexp_replace(coalesce(sl.vehicle_reg, ''), '\s', '', 'g')) ~ '^[A-Z]{3}[0-9]{1,4}$'
  AND substring(upper(regexp_replace(coalesce(sl.vehicle_reg, ''), '\s', '', 'g')) from 1 for 3) ~ '[IZ]'
ON CONFLICT DO NOTHING;