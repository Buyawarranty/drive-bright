
ALTER TABLE public.sales_leads DISABLE TRIGGER trg_protect_worked_lead_assignment;

UPDATE public.sales_leads
SET assigned_to = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5',
    assigned_at = now(),
    last_activity_date = now(),
    status = CASE WHEN is_paid THEN 'converted'::lead_status ELSE 'new'::lead_status END,
    updated_at = now()
WHERE lower(email) IN (
  SELECT DISTINCT lower(email) FROM public.abandoned_carts
    WHERE (created_at AT TIME ZONE 'Europe/London')::date = '2026-07-19' AND email IS NOT NULL
  UNION
  SELECT DISTINCT lower(email) FROM public.customers
    WHERE (signup_date AT TIME ZONE 'Europe/London')::date = '2026-07-19' AND email IS NOT NULL
);

ALTER TABLE public.sales_leads ENABLE TRIGGER trg_protect_worked_lead_assignment;
