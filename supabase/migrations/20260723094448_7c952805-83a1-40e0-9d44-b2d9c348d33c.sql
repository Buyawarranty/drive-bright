
CREATE OR REPLACE FUNCTION public.preview_agent_offboarding_backup(
  _source_admin_user_id UUID,
  _target_admin_user_id UUID,
  _reset_to_new BOOLEAN DEFAULT false,
  _also_deactivate BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src RECORD;
  v_tgt RECORD;
  v_total INT := 0;
  v_paid INT := 0;
  v_open INT := 0;
  v_reset INT := 0;
  v_reminders INT := 0;
  v_changelog INT := 0;
  v_quick INT := 0;
  v_calls INT := 0;
  v_leads JSONB;
BEGIN
  IF NOT public.is_management(auth.uid()) THEN
    RAISE EXCEPTION 'Only management can preview offboarding';
  END IF;

  IF _source_admin_user_id IS NULL OR _target_admin_user_id IS NULL OR _source_admin_user_id = _target_admin_user_id THEN
    RAISE EXCEPTION 'Source and target agents must differ and be non-null';
  END IF;

  SELECT id, email, COALESCE(NULLIF(TRIM(first_name || ' ' || COALESCE(last_name,'')), ''), email) AS name
    INTO v_src FROM public.admin_users WHERE id = _source_admin_user_id;
  SELECT id, email, COALESCE(NULLIF(TRIM(first_name || ' ' || COALESCE(last_name,'')), ''), email) AS name
    INTO v_tgt FROM public.admin_users WHERE id = _target_admin_user_id;

  IF v_src.id IS NULL OR v_tgt.id IS NULL THEN
    RAISE EXCEPTION 'Source or target admin not found';
  END IF;

  -- Per-lead breakdown (bounded to keep payload sane)
  WITH src_leads AS (
    SELECT * FROM public.sales_leads WHERE assigned_to = _source_admin_user_id
  ),
  enriched AS (
    SELECT
      l.id,
      COALESCE(NULLIF(TRIM(COALESCE(l.first_name,'') || ' ' || COALESCE(l.last_name,'')), ''),
               l.email, l.phone, l.registration_plate, l.id::text) AS label,
      l.status,
      l.is_paid,
      l.created_at,
      l.last_activity_date,
      (SELECT COUNT(*) FROM public.lead_quick_notes qn WHERE qn.lead_id = l.id) AS quick_notes,
      (SELECT COUNT(*) FROM public.sales_leads_changelog cl WHERE cl.lead_id = l.id) AS changelog,
      (SELECT COUNT(*) FROM public.lead_reminders r WHERE r.lead_id = l.id AND r.is_completed = false) AS reminders_open,
      (SELECT COUNT(*) FROM public.lead_call_logs c WHERE c.lead_id = l.id) AS calls
    FROM src_leads l
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_paid),
    COUNT(*) FILTER (WHERE NOT is_paid AND status NOT IN ('lost','fake_lead','converted','not_interested','dormant','archived')),
    COUNT(*) FILTER (WHERE _reset_to_new AND NOT is_paid),
    COALESCE(SUM(reminders_open),0),
    COALESCE(SUM(changelog),0),
    COALESCE(SUM(quick_notes),0),
    COALESCE(SUM(calls),0),
    COALESCE(
      jsonb_agg(jsonb_build_object(
        'lead_id', id,
        'label', label,
        'status', status,
        'is_paid', is_paid,
        'created_at', created_at,
        'last_activity_date', last_activity_date,
        'quick_notes', quick_notes,
        'changelog', changelog,
        'reminders_open', reminders_open,
        'calls', calls,
        'will_reset_to_new', (_reset_to_new AND NOT is_paid)
      ) ORDER BY last_activity_date DESC NULLS LAST, created_at DESC),
      '[]'::jsonb)
    INTO v_total, v_paid, v_open, v_reset, v_reminders, v_changelog, v_quick, v_calls, v_leads
  FROM enriched;

  RETURN jsonb_build_object(
    'dry_run', true,
    'source', jsonb_build_object('id', v_src.id, 'name', v_src.name, 'email', v_src.email),
    'target', jsonb_build_object('id', v_tgt.id, 'name', v_tgt.name, 'email', v_tgt.email),
    'options', jsonb_build_object('reset_to_new', COALESCE(_reset_to_new,false), 'also_deactivate', COALESCE(_also_deactivate,false)),
    'totals', jsonb_build_object(
      'leads', v_total,
      'paid_leads', v_paid,
      'open_leads', v_open,
      'leads_reset_to_new', v_reset,
      'reminders_moved', v_reminders,
      'quick_notes_preserved', v_quick,
      'changelog_preserved', v_changelog,
      'call_logs_preserved', v_calls
    ),
    'leads', v_leads
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_agent_offboarding_backup(UUID, UUID, BOOLEAN, BOOLEAN) TO authenticated;
