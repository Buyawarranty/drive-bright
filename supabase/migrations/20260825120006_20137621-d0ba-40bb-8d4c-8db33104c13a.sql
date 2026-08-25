INSERT INTO public.lead_tags (name, color, description, is_active)
SELECT 'Fake lead', '#dc2626', 'Known test/fake phone number', true
WHERE NOT EXISTS (SELECT 1 FROM public.lead_tags WHERE lower(name) = 'fake lead');

CREATE OR REPLACE FUNCTION public.is_known_fake_phone(_phone text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _phone IS NULL THEN false
    ELSE right(regexp_replace(_phone, '\D', '', 'g'), 9) = '960111131'
  END
$$;

CREATE OR REPLACE FUNCTION public.flag_fake_test_phone_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag_id uuid;
BEGIN
  IF public.is_known_fake_phone(NEW.phone) OR public.is_known_fake_phone(NEW.phone_normalized) THEN
    SELECT id INTO v_tag_id FROM public.lead_tags WHERE lower(name) = 'fake lead' LIMIT 1;
    IF v_tag_id IS NOT NULL THEN
      INSERT INTO public.lead_tag_assignments (lead_id, tag_id)
      SELECT NEW.id, v_tag_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.lead_tag_assignments
        WHERE lead_id = NEW.id AND tag_id = v_tag_id
      );
    END IF;

    IF NEW.status IS DISTINCT FROM 'fake_lead'::lead_status THEN
      UPDATE public.sales_leads SET status = 'fake_lead'::lead_status WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_fake_test_phone_lead ON public.sales_leads;
CREATE TRIGGER trg_flag_fake_test_phone_lead
AFTER INSERT OR UPDATE OF phone, phone_normalized ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.flag_fake_test_phone_lead();

INSERT INTO public.lead_tag_assignments (lead_id, tag_id)
SELECT sl.id, lt.id
FROM public.sales_leads sl
CROSS JOIN (SELECT id FROM public.lead_tags WHERE lower(name) = 'fake lead' LIMIT 1) lt
WHERE (public.is_known_fake_phone(sl.phone) OR public.is_known_fake_phone(sl.phone_normalized))
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_tag_assignments a WHERE a.lead_id = sl.id AND a.tag_id = lt.id
  );

UPDATE public.sales_leads
SET status = 'fake_lead'::lead_status
WHERE (public.is_known_fake_phone(phone) OR public.is_known_fake_phone(phone_normalized))
  AND status IS DISTINCT FROM 'fake_lead'::lead_status;