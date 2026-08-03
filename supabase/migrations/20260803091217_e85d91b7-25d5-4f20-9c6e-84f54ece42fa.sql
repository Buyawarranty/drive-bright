DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('app.allow_reassign', 'on', true);

  WITH moves AS (
    SELECT DISTINCT ON (lead_id) lead_id
    FROM public.sales_leads_changelog
    WHERE old_assigned_to = '98dc0e81-9f83-45b9-8c98-e7875b314dec'
      AND new_assigned_to IS DISTINCT FROM '98dc0e81-9f83-45b9-8c98-e7875b314dec'
      AND changed_at >= '2026-08-01'
    ORDER BY lead_id, changed_at DESC
  ), upd AS (
    UPDATE public.sales_leads sl
    SET assigned_to = '98dc0e81-9f83-45b9-8c98-e7875b314dec',
        updated_at = now()
    FROM moves m
    WHERE sl.id = m.lead_id
      AND sl.assigned_to IS DISTINCT FROM '98dc0e81-9f83-45b9-8c98-e7875b314dec'
      AND COALESCE(sl.status::text, '') <> 'converted'
    RETURNING sl.id
  )
  SELECT count(*) INTO v_count FROM upd;

  RAISE NOTICE 'Leads restored to Thomas: %', v_count;

  PERFORM set_config('app.allow_reassign', 'off', true);
END $$;