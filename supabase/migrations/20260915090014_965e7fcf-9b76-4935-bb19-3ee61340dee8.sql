CREATE OR REPLACE FUNCTION public.save_lead_quick_note(
  p_lead_id uuid,
  p_note_text text
)
RETURNS public.lead_quick_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin public.admin_users%ROWTYPE;
  v_note public.lead_quick_notes%ROWTYPE;
  v_text text := btrim(coalesce(p_note_text, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Session expired';
  END IF;

  IF v_text = '' THEN
    RAISE EXCEPTION 'Note cannot be empty';
  END IF;

  SELECT * INTO v_admin
  FROM public.admin_users
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;

  IF v_admin.id IS NULL THEN
    RAISE EXCEPTION 'Active staff account not found';
  END IF;

  INSERT INTO public.lead_quick_notes (
    lead_id,
    note_text,
    created_by,
    author_name,
    is_pinned
  ) VALUES (
    p_lead_id,
    v_text,
    v_admin.id,
    COALESCE(NULLIF(btrim(concat_ws(' ', v_admin.first_name, v_admin.last_name)), ''), v_admin.email),
    false
  )
  RETURNING * INTO v_note;

  RETURN v_note;
END;
$$;

REVOKE ALL ON FUNCTION public.save_lead_quick_note(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_lead_quick_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_lead_quick_note(uuid, text) TO service_role;