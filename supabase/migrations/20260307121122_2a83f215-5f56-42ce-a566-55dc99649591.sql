CREATE OR REPLACE FUNCTION public.sync_leads_to_marketing_audience()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id UUID;
  v_total INTEGER := 0;
BEGIN
  INSERT INTO marketing_audience_sync_log (sync_type, status)
  VALUES ('auto', 'running')
  RETURNING id INTO v_log_id;

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

  UPDATE marketing_audience_sync_log
  SET completed_at = now(), leads_processed = v_total, leads_added = v_total, leads_updated = 0, status = 'completed'
  WHERE id = v_log_id;

  RETURN jsonb_build_object('success', true, 'processed', v_total, 'added', v_total, 'updated', 0, 'log_id', v_log_id);
EXCEPTION WHEN OTHERS THEN
  UPDATE marketing_audience_sync_log SET status = 'failed', errors = jsonb_build_array(SQLERRM), completed_at = now() WHERE id = v_log_id;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;