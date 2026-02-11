
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

  -- Sync from sales_leads (first_name + last_name, lead_source)
  INSERT INTO marketing_audience (lead_id, reg_plate, mileage, email, phone, full_name, source, source_type, lead_status, synced_at)
  SELECT 
    sl.id,
    sl.vehicle_reg,
    sl.mileage,
    NULLIF(TRIM(sl.email), ''),
    NULLIF(TRIM(sl.phone), ''),
    TRIM(COALESCE(sl.first_name, '') || ' ' || COALESCE(sl.last_name, '')),
    sl.lead_source,
    'sales_lead',
    sl.status,
    now()
  FROM sales_leads sl
  WHERE (sl.email IS NOT NULL AND TRIM(sl.email) != '')
     OR (sl.phone IS NOT NULL AND TRIM(sl.phone) != '')
  ON CONFLICT (email, phone) DO UPDATE SET
    reg_plate = COALESCE(EXCLUDED.reg_plate, marketing_audience.reg_plate),
    mileage = COALESCE(EXCLUDED.mileage, marketing_audience.mileage),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ' '), marketing_audience.full_name),
    lead_status = EXCLUDED.lead_status,
    synced_at = now(),
    updated_at = now();

  GET DIAGNOSTICS v_processed = ROW_COUNT;
  v_added := v_processed;

  -- Sync from abandoned_carts (full_name, no source column)
  INSERT INTO marketing_audience (lead_id, reg_plate, mileage, email, phone, full_name, source, source_type, lead_status, synced_at)
  SELECT 
    ac.id,
    ac.vehicle_reg,
    ac.mileage,
    NULLIF(TRIM(ac.email), ''),
    NULLIF(TRIM(ac.phone), ''),
    ac.full_name,
    'abandoned_cart',
    'abandoned_cart',
    ac.contact_status,
    now()
  FROM abandoned_carts ac
  WHERE ((ac.email IS NOT NULL AND TRIM(ac.email) != '')
     OR (ac.phone IS NOT NULL AND TRIM(ac.phone) != ''))
    AND ac.is_converted = false
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
