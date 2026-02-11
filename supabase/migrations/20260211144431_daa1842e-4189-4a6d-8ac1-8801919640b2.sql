
CREATE OR REPLACE FUNCTION public.sync_leads_to_marketing_audience()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id UUID;
  v_processed INTEGER := 0;
  v_added INTEGER := 0;
  v_updated INTEGER := 0;
BEGIN
  INSERT INTO marketing_audience_sync_log (sync_type, status)
  VALUES ('auto', 'running')
  RETURNING id INTO v_log_id;

  -- Sync from sales_leads - DISTINCT ON (email, phone) to avoid duplicate conflict
  INSERT INTO marketing_audience (lead_id, reg_plate, mileage, email, phone, full_name, source, source_type, lead_status, synced_at)
  SELECT 
    sub.id,
    sub.vehicle_reg,
    sub.mileage,
    sub.email,
    sub.phone,
    sub.full_name,
    sub.lead_source,
    'sales_lead',
    sub.status,
    now()
  FROM (
    SELECT DISTINCT ON (NULLIF(TRIM(email), ''), NULLIF(TRIM(phone), ''))
      id,
      vehicle_reg,
      mileage,
      NULLIF(TRIM(email), '') as email,
      NULLIF(TRIM(phone), '') as phone,
      TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) as full_name,
      lead_source,
      status,
      created_at
    FROM sales_leads
    WHERE (email IS NOT NULL AND TRIM(email) != '')
       OR (phone IS NOT NULL AND TRIM(phone) != '')
    ORDER BY NULLIF(TRIM(email), ''), NULLIF(TRIM(phone), ''), created_at DESC
  ) sub
  ON CONFLICT (email, phone) DO UPDATE SET
    reg_plate = COALESCE(EXCLUDED.reg_plate, marketing_audience.reg_plate),
    mileage = COALESCE(EXCLUDED.mileage, marketing_audience.mileage),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ' '), marketing_audience.full_name),
    lead_status = EXCLUDED.lead_status,
    synced_at = now(),
    updated_at = now();

  GET DIAGNOSTICS v_processed = ROW_COUNT;
  v_added := v_processed;

  -- Sync from abandoned_carts - DISTINCT ON to avoid duplicate conflict
  INSERT INTO marketing_audience (lead_id, reg_plate, mileage, email, phone, full_name, source, source_type, lead_status, synced_at)
  SELECT 
    sub.id,
    sub.vehicle_reg,
    sub.mileage,
    sub.email,
    sub.phone,
    sub.full_name,
    'abandoned_cart',
    'abandoned_cart',
    sub.contact_status,
    now()
  FROM (
    SELECT DISTINCT ON (NULLIF(TRIM(email), ''), NULLIF(TRIM(phone), ''))
      id,
      vehicle_reg,
      mileage,
      NULLIF(TRIM(email), '') as email,
      NULLIF(TRIM(phone), '') as phone,
      full_name,
      contact_status,
      created_at
    FROM abandoned_carts
    WHERE ((email IS NOT NULL AND TRIM(email) != '')
       OR (phone IS NOT NULL AND TRIM(phone) != ''))
      AND is_converted = false
    ORDER BY NULLIF(TRIM(email), ''), NULLIF(TRIM(phone), ''), created_at DESC
  ) sub
  ON CONFLICT (email, phone) DO UPDATE SET
    reg_plate = COALESCE(EXCLUDED.reg_plate, marketing_audience.reg_plate),
    mileage = COALESCE(EXCLUDED.mileage, marketing_audience.mileage),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), marketing_audience.full_name),
    synced_at = now(),
    updated_at = now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  v_processed := v_processed + v_updated;

  UPDATE marketing_audience_sync_log
  SET completed_at = now(), leads_processed = v_processed, leads_added = v_added, leads_updated = v_updated, status = 'completed'
  WHERE id = v_log_id;

  RETURN jsonb_build_object('success', true, 'processed', v_processed, 'added', v_added, 'updated', v_updated, 'log_id', v_log_id);
EXCEPTION WHEN OTHERS THEN
  UPDATE marketing_audience_sync_log SET status = 'failed', errors = jsonb_build_array(SQLERRM), completed_at = now() WHERE id = v_log_id;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
