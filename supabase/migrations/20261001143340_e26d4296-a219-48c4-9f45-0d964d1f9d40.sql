ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS fbclid text;

CREATE OR REPLACE FUNCTION public.fill_customer_meta_attribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m jsonb;
BEGIN
  IF NEW.fbclid IS NOT NULL AND NEW.utm_content IS NOT NULL THEN RETURN NEW; END IF;
  SELECT ac.cart_metadata INTO m
  FROM public.abandoned_carts ac
  WHERE (
      (NEW.email IS NOT NULL AND lower(trim(ac.email)) = lower(trim(NEW.email)))
      OR (NEW.registration_plate IS NOT NULL AND upper(replace(ac.vehicle_reg,' ','')) = upper(replace(NEW.registration_plate,' ','')))
    )
    AND (ac.cart_metadata ? 'fbclid' OR lower(coalesce(ac.cart_metadata->>'utm_source','')) IN ('fb','facebook','ig','instagram','meta'))
    AND ac.created_at <= coalesce(NEW.signup_date, now()) + interval '1 day'
    AND ac.created_at >= coalesce(NEW.signup_date, now()) - interval '90 days'
  ORDER BY (ac.cart_metadata ? 'fbclid') DESC, ac.created_at DESC
  LIMIT 1;
  IF m IS NULL THEN RETURN NEW; END IF;
  NEW.fbclid := coalesce(NEW.fbclid, nullif(m->>'fbclid',''));
  IF NEW.utm_source IS NULL AND NEW.utm_campaign IS NULL AND NEW.utm_content IS NULL THEN
    NEW.utm_source := nullif(m->>'utm_source','');
    NEW.utm_medium := coalesce(NEW.utm_medium, nullif(m->>'utm_medium',''));
    NEW.utm_campaign := nullif(m->>'utm_campaign','');
    NEW.utm_term := coalesce(NEW.utm_term, nullif(m->>'utm_term',''));
    NEW.utm_content := nullif(m->>'utm_content','');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fill_customer_meta_attribution ON public.customers;
CREATE TRIGGER trg_fill_customer_meta_attribution
BEFORE INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.fill_customer_meta_attribution();

-- Backfill recent sales (Meta fields only; gclid untouched)
WITH src AS (
  SELECT DISTINCT ON (c.id) c.id, ac.cart_metadata m
  FROM public.customers c
  JOIN public.abandoned_carts ac ON (
      (c.email IS NOT NULL AND lower(trim(ac.email)) = lower(trim(c.email)))
      OR (c.registration_plate IS NOT NULL AND upper(replace(ac.vehicle_reg,' ','')) = upper(replace(c.registration_plate,' ','')))
    )
  WHERE c.fbclid IS NULL
    AND c.signup_date >= now() - interval '120 days'
    AND (ac.cart_metadata ? 'fbclid' OR lower(coalesce(ac.cart_metadata->>'utm_source','')) IN ('fb','facebook','ig','instagram','meta'))
    AND ac.created_at <= c.signup_date + interval '1 day'
    AND ac.created_at >= c.signup_date - interval '90 days'
  ORDER BY c.id, (ac.cart_metadata ? 'fbclid') DESC, ac.created_at DESC
)
UPDATE public.customers c SET
  fbclid = nullif(src.m->>'fbclid',''),
  utm_source = CASE WHEN c.utm_source IS NULL AND c.utm_campaign IS NULL AND c.utm_content IS NULL THEN nullif(src.m->>'utm_source','') ELSE c.utm_source END,
  utm_medium = CASE WHEN c.utm_source IS NULL AND c.utm_campaign IS NULL AND c.utm_content IS NULL THEN nullif(src.m->>'utm_medium','') ELSE c.utm_medium END,
  utm_campaign = CASE WHEN c.utm_source IS NULL AND c.utm_campaign IS NULL AND c.utm_content IS NULL THEN nullif(src.m->>'utm_campaign','') ELSE c.utm_campaign END,
  utm_term = CASE WHEN c.utm_source IS NULL AND c.utm_campaign IS NULL AND c.utm_content IS NULL THEN nullif(src.m->>'utm_term','') ELSE c.utm_term END,
  utm_content = CASE WHEN c.utm_source IS NULL AND c.utm_campaign IS NULL AND c.utm_content IS NULL THEN nullif(src.m->>'utm_content','') ELSE c.utm_content END
FROM src WHERE src.id = c.id;