-- 1. Helper: is this email an existing (bought) or cancelled customer?
CREATE OR REPLACE FUNCTION public.marketing_customer_state(_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN bool_or(lower(coalesce(c.status,'')) IN ('cancelled','refunded')) THEN 'cancelled'
           ELSE 'customer'
         END
  FROM public.customers c
  WHERE lower(trim(c.email)) = lower(trim(_email))
  HAVING count(*) > 0
$$;

-- 2. Immediate suppression backfill --------------------------------------

-- 2a. Cancelled / refunded customers: fully off
UPDATE public.marketing_audience ma
SET is_subscribed = false,
    frequency = 'off',
    unsubscribed_at = COALESCE(ma.unsubscribed_at, now())
WHERE public.marketing_customer_state(ma.email) = 'cancelled';

-- 2b. Paying customers: promotional marketing off, renewal essentials only
UPDATE public.marketing_audience ma
SET frequency = 'essentials'
WHERE public.marketing_customer_state(ma.email) = 'customer'
  AND COALESCE(ma.frequency, 'all') = 'all';

-- 2c. Blocklist rows for cancelled customers so every send path respects it
INSERT INTO public.email_unsubscribes (email, reason, source, customer_name, vehicle_reg, frequency)
SELECT DISTINCT ON (lower(trim(c.email)))
       lower(trim(c.email)),
       'Cancelled customer — marketing suppressed',
       'customer_suppression',
       c.name,
       c.registration_plate,
       'off'
FROM public.customers c
WHERE c.email IS NOT NULL AND trim(c.email) <> ''
  AND lower(coalesce(c.status,'')) IN ('cancelled','refunded')
ORDER BY lower(trim(c.email)), c.created_at DESC
ON CONFLICT (email) DO NOTHING;

-- 2d. PREEYEN Parmar — full opt-out as requested
UPDATE public.marketing_audience
SET is_subscribed = false, frequency = 'off', unsubscribed_at = COALESCE(unsubscribed_at, now())
WHERE email = 'piwi01@hotmail.com';

INSERT INTO public.email_unsubscribes (email, reason, source, customer_name, vehicle_reg, frequency)
VALUES ('piwi01@hotmail.com', 'Paying customer asked to be removed from marketing email',
        'customer_suppression', 'PREEYEN Parmar', 'DA16 TLJ', 'off')
ON CONFLICT (email) DO UPDATE
SET frequency = 'off',
    reason = EXCLUDED.reason,
    source = EXCLUDED.source;

-- 3. Rebuild the sync so it preserves preferences and suppresses customers
CREATE OR REPLACE FUNCTION public.sync_leads_to_marketing_audience()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_log_id UUID;
  v_total INTEGER := 0;
BEGIN
  INSERT INTO marketing_audience_sync_log (sync_type, status)
  VALUES ('auto', 'running')
  RETURNING id INTO v_log_id;

  -- Snapshot existing preferences so a rebuild never resurrects an opt-out.
  CREATE TEMP TABLE _prefs ON COMMIT DROP AS
  SELECT lower(trim(email)) AS email,
         bool_and(COALESCE(is_subscribed, true)) AS is_subscribed,
         min(COALESCE(frequency, 'all')) AS frequency,
         max(unsubscribed_at) AS unsubscribed_at
  FROM marketing_audience
  WHERE email IS NOT NULL AND trim(email) <> ''
  GROUP BY 1;

  TRUNCATE marketing_audience;

  INSERT INTO marketing_audience (lead_id, reg_plate, mileage, email, phone, full_name, source, source_type, lead_status, step_abandoned, synced_at)
  SELECT sub.lead_id, sub.reg_plate, sub.mileage, sub.email, sub.phone, sub.full_name, sub.source, sub.source_type, sub.lead_status, sub.step_abandoned, now()
  FROM (
    SELECT DISTINCT ON (COALESCE(combined.email, ''), COALESCE(combined.phone, ''))
      combined.*
    FROM (
      SELECT
        sl.id as lead_id,
        sl.vehicle_reg as reg_plate,
        sl.mileage,
        NULLIF(TRIM(sl.email), '') as email,
        NULLIF(TRIM(sl.phone), '') as phone,
        TRIM(COALESCE(sl.first_name, '') || ' ' || COALESCE(sl.last_name, '')) as full_name,
        sl.lead_source::text as source,
        'sales_lead'::text as source_type,
        sl.status::text as lead_status,
        NULL::integer as step_abandoned,
        sl.created_at
      FROM sales_leads sl
      WHERE (sl.email IS NOT NULL AND TRIM(sl.email) != '')
         OR (sl.phone IS NOT NULL AND TRIM(sl.phone) != '')

      UNION ALL

      SELECT
        ac.id as lead_id,
        ac.vehicle_reg as reg_plate,
        ac.mileage,
        NULLIF(TRIM(ac.email), '') as email,
        NULLIF(TRIM(ac.phone), '') as phone,
        ac.full_name,
        'abandoned_cart'::text as source,
        'abandoned_cart'::text as source_type,
        ac.contact_status as lead_status,
        ac.step_abandoned,
        ac.created_at
      FROM abandoned_carts ac
      WHERE ((ac.email IS NOT NULL AND TRIM(ac.email) != '')
         OR (ac.phone IS NOT NULL AND TRIM(ac.phone) != ''))
        AND ac.is_converted = false
    ) combined
    ORDER BY COALESCE(combined.email, ''), COALESCE(combined.phone, ''), combined.created_at DESC
  ) sub;

  GET DIAGNOSTICS v_total = ROW_COUNT;

  -- Re-apply saved preferences.
  UPDATE marketing_audience ma
  SET is_subscribed = p.is_subscribed,
      frequency = p.frequency,
      unsubscribed_at = p.unsubscribed_at
  FROM _prefs p
  WHERE lower(trim(ma.email)) = p.email;

  -- Hard blocklist always wins.
  UPDATE marketing_audience ma
  SET is_subscribed = false, frequency = 'off', unsubscribed_at = COALESCE(ma.unsubscribed_at, now())
  WHERE EXISTS (
    SELECT 1 FROM email_unsubscribes eu WHERE lower(trim(eu.email)) = lower(trim(ma.email))
  );

  -- Cancelled customers: no marketing at all.
  UPDATE marketing_audience ma
  SET is_subscribed = false, frequency = 'off', unsubscribed_at = COALESCE(ma.unsubscribed_at, now())
  WHERE public.marketing_customer_state(ma.email) = 'cancelled';

  -- Paying customers: renewal essentials only, never promotional campaigns.
  UPDATE marketing_audience ma
  SET frequency = 'essentials'
  WHERE public.marketing_customer_state(ma.email) = 'customer'
    AND COALESCE(ma.frequency, 'all') = 'all';

  UPDATE marketing_audience_sync_log
  SET completed_at = now(), leads_processed = v_total, leads_added = v_total, leads_updated = 0, status = 'completed'
  WHERE id = v_log_id;

  RETURN jsonb_build_object('success', true, 'processed', v_total, 'added', v_total, 'updated', 0, 'log_id', v_log_id);
EXCEPTION WHEN OTHERS THEN
  UPDATE marketing_audience_sync_log SET status = 'failed', errors = jsonb_build_array(SQLERRM), completed_at = now() WHERE id = v_log_id;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;