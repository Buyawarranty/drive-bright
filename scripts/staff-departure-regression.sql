-- Run within an administrator-controlled SQL session; read-only assertions.
DO $$
BEGIN
  IF NOT public.staff_departure_customer_visible('sales',true,'2026-08-30 09:00Z',NULL,'2026-10-30 09:00Z') THEN RAISE EXCEPTION 'Two-month boundary failed'; END IF;
  IF public.staff_departure_customer_visible('sales_lead',true,'2026-08-30 08:59Z',NULL,'2026-10-30 09:00Z') THEN RAISE EXCEPTION 'Historic customer leaked'; END IF;
  IF NOT public.staff_departure_customer_visible('sales',false,'2026-01-01','2026-10-31 09:00Z','2026-10-30 09:00Z') THEN RAISE EXCEPTION '24-hour approval failed'; END IF;
  IF public.staff_departure_customer_visible('sales',false,'2026-01-01','2026-10-31 09:00Z','2026-10-31 09:00Z') THEN RAISE EXCEPTION 'Expired approval leaked'; END IF;
  IF has_function_privilege('authenticated','public.record_staff_crm_view(text,jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Actor spoof possible'; END IF;
  IF public.staff_crm_redact('{"token":"secret","nested":{"password":"secret","status":"new"}}') <> '{"nested":{"status":"new"}}'::jsonb THEN RAISE EXCEPTION 'Redaction failed'; END IF;
END $$;