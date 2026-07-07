
-- List recent bulk reassignment batches
CREATE OR REPLACE FUNCTION public.list_recent_bulk_reassignments(
  p_hours int DEFAULT 24,
  p_min_batch int DEFAULT 3
)
RETURNS TABLE(
  batch_key text,
  changed_by uuid,
  old_assigned_to uuid,
  new_assigned_to uuid,
  bucket_start timestamptz,
  first_changed_at timestamptz,
  last_changed_at timestamptz,
  lead_count bigint,
  still_on_new_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_role text;
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT role INTO v_role FROM public.admin_users WHERE user_id = v_caller_id AND is_active = true;
  IF v_role NOT IN ('admin','super_admin','sales_manager') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH bucketed AS (
    SELECT
      c.lead_id,
      c.changed_by,
      c.old_assigned_to,
      c.new_assigned_to,
      c.changed_at,
      date_bin('5 minutes'::interval, c.changed_at, timestamptz '2000-01-01') AS bucket
    FROM public.sales_leads_changelog c
    WHERE c.changed_at >= now() - make_interval(hours => p_hours)
      AND c.old_assigned_to IS DISTINCT FROM c.new_assigned_to
  ),
  grouped AS (
    SELECT
      b.changed_by,
      b.old_assigned_to,
      b.new_assigned_to,
      b.bucket,
      MIN(b.changed_at) AS first_at,
      MAX(b.changed_at) AS last_at,
      COUNT(*) AS n,
      array_agg(DISTINCT b.lead_id) AS lead_ids
    FROM bucketed b
    GROUP BY b.changed_by, b.old_assigned_to, b.new_assigned_to, b.bucket
    HAVING COUNT(*) >= p_min_batch
  )
  SELECT
    (COALESCE(g.changed_by::text,'nil') || '|' ||
     COALESCE(g.old_assigned_to::text,'nil') || '|' ||
     COALESCE(g.new_assigned_to::text,'nil') || '|' ||
     to_char(g.bucket AT TIME ZONE 'UTC','YYYYMMDDHH24MI')) AS batch_key,
    g.changed_by,
    g.old_assigned_to,
    g.new_assigned_to,
    g.bucket,
    g.first_at,
    g.last_at,
    g.n,
    (SELECT COUNT(*) FROM public.sales_leads sl
      WHERE sl.id = ANY(g.lead_ids)
        AND sl.assigned_to IS NOT DISTINCT FROM g.new_assigned_to
        AND sl.status NOT IN ('lost','fake_lead','converted'))
  FROM grouped g
  ORDER BY g.last_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_recent_bulk_reassignments(int,int) TO authenticated;

-- Undo a specific bulk reassignment batch
CREATE OR REPLACE FUNCTION public.undo_bulk_reassignment(
  p_changed_by uuid,
  p_old_assigned_to uuid,
  p_new_assigned_to uuid,
  p_bucket_start timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_role text;
  v_now timestamptz := now();
  v_ids uuid[];
  v_count int := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  SELECT role INTO v_role FROM public.admin_users WHERE user_id = v_caller_id AND is_active = true;
  IF v_role NOT IN ('admin','super_admin','sales_manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Refuse if outside the 24h window
  IF p_bucket_start < now() - interval '24 hours' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Undo window has expired (24 hours)');
  END IF;

  -- Find leads changed in that batch that are STILL on the new agent
  SELECT array_agg(DISTINCT c.lead_id) INTO v_ids
  FROM public.sales_leads_changelog c
  JOIN public.sales_leads sl ON sl.id = c.lead_id
  WHERE c.changed_at >= p_bucket_start
    AND c.changed_at < p_bucket_start + interval '5 minutes'
    AND c.old_assigned_to IS NOT DISTINCT FROM p_old_assigned_to
    AND c.new_assigned_to IS NOT DISTINCT FROM p_new_assigned_to
    AND (p_changed_by IS NULL OR c.changed_by IS NOT DISTINCT FROM p_changed_by)
    AND sl.assigned_to IS NOT DISTINCT FROM p_new_assigned_to
    AND sl.status NOT IN ('lost','fake_lead','converted');

  IF COALESCE(array_length(v_ids,1),0) = 0 THEN
    RETURN jsonb_build_object('success', true, 'reverted', 0, 'note', 'Nothing to revert');
  END IF;

  UPDATE public.sales_leads
  SET assigned_to = p_old_assigned_to,
      assigned_at = CASE WHEN p_old_assigned_to IS NULL THEN NULL ELSE v_now END,
      updated_at = v_now
  WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'reverted', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_bulk_reassignment(uuid,uuid,uuid,timestamptz) TO authenticated;
