
-- Foolproof agent offboarding backup: snapshot every lead + related notes/reminders
-- BEFORE handover, and expose a restore RPC so nothing is ever lost.

CREATE TABLE IF NOT EXISTS public.agent_offboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_admin_user_id UUID NOT NULL,
  target_admin_user_id UUID NOT NULL,
  source_name TEXT,
  source_email TEXT,
  target_name TEXT,
  target_email TEXT,
  executed_by UUID,
  executed_by_name TEXT,
  lead_count INTEGER NOT NULL DEFAULT 0,
  paid_lead_count INTEGER NOT NULL DEFAULT 0,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  reset_to_new BOOLEAN NOT NULL DEFAULT false,
  also_deactivated BOOLEAN NOT NULL DEFAULT false,
  restored_at TIMESTAMPTZ,
  restored_by UUID,
  restored_lead_count INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agent_offboarding_events TO authenticated;
GRANT ALL ON public.agent_offboarding_events TO service_role;
ALTER TABLE public.agent_offboarding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view offboarding events"
  ON public.agent_offboarding_events FOR SELECT TO authenticated
  USING (public.is_management(auth.uid()));

CREATE TABLE IF NOT EXISTS public.agent_offboarding_lead_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.agent_offboarding_events(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL,
  original_assigned_to UUID,
  original_status TEXT,
  original_is_paid BOOLEAN,
  lead_snapshot JSONB NOT NULL,
  quick_notes JSONB,
  changelog JSONB,
  reminders JSONB,
  call_logs JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offboarding_snapshots_event ON public.agent_offboarding_lead_snapshots(event_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_snapshots_lead ON public.agent_offboarding_lead_snapshots(lead_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_events_source ON public.agent_offboarding_events(source_admin_user_id);

GRANT SELECT ON public.agent_offboarding_lead_snapshots TO authenticated;
GRANT ALL ON public.agent_offboarding_lead_snapshots TO service_role;
ALTER TABLE public.agent_offboarding_lead_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view offboarding snapshots"
  ON public.agent_offboarding_lead_snapshots FOR SELECT TO authenticated
  USING (public.is_management(auth.uid()));

-- Snapshot + handover in one atomic call
CREATE OR REPLACE FUNCTION public.create_agent_offboarding_backup(
  _source_admin_user_id UUID,
  _target_admin_user_id UUID,
  _reset_to_new BOOLEAN DEFAULT false,
  _also_deactivate BOOLEAN DEFAULT false,
  _notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_caller_admin_id UUID;
  v_caller_name TEXT;
  v_src RECORD;
  v_tgt RECORD;
  v_lead_count INT := 0;
  v_paid_count INT := 0;
  v_reminder_count INT := 0;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Auth: management only
  SELECT id, COALESCE(NULLIF(TRIM(first_name || ' ' || COALESCE(last_name,'')), ''), email)
    INTO v_caller_admin_id, v_caller_name
    FROM public.admin_users WHERE user_id = auth.uid() LIMIT 1;

  IF NOT public.is_management(auth.uid()) THEN
    RAISE EXCEPTION 'Only management can offboard agents';
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

  -- Create event row first so snapshots can reference it
  INSERT INTO public.agent_offboarding_events (
    source_admin_user_id, target_admin_user_id,
    source_name, source_email, target_name, target_email,
    executed_by, executed_by_name,
    reset_to_new, also_deactivated, notes
  ) VALUES (
    _source_admin_user_id, _target_admin_user_id,
    v_src.name, v_src.email, v_tgt.name, v_tgt.email,
    v_caller_admin_id, v_caller_name,
    COALESCE(_reset_to_new, false), COALESCE(_also_deactivate, false), _notes
  ) RETURNING id INTO v_event_id;

  -- Snapshot every lead currently owned by the source agent, along with all related history
  WITH src_leads AS (
    SELECT * FROM public.sales_leads WHERE assigned_to = _source_admin_user_id
  ),
  ins AS (
    INSERT INTO public.agent_offboarding_lead_snapshots (
      event_id, lead_id, original_assigned_to, original_status, original_is_paid,
      lead_snapshot, quick_notes, changelog, reminders, call_logs
    )
    SELECT
      v_event_id,
      l.id,
      l.assigned_to,
      l.status,
      l.is_paid,
      to_jsonb(l),
      COALESCE((SELECT jsonb_agg(to_jsonb(qn)) FROM public.lead_quick_notes qn WHERE qn.lead_id = l.id), '[]'::jsonb),
      COALESCE((SELECT jsonb_agg(to_jsonb(cl)) FROM public.sales_leads_changelog cl WHERE cl.lead_id = l.id), '[]'::jsonb),
      COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.lead_reminders r WHERE r.lead_id = l.id), '[]'::jsonb),
      COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.lead_call_logs c WHERE c.lead_id = l.id), '[]'::jsonb)
    FROM src_leads l
    RETURNING lead_id, original_is_paid
  )
  SELECT COUNT(*), COUNT(*) FILTER (WHERE original_is_paid) INTO v_lead_count, v_paid_count FROM ins;

  -- Reassign every lead
  UPDATE public.sales_leads
     SET assigned_to = _target_admin_user_id,
         assigned_at = v_now,
         last_activity_date = v_now
   WHERE assigned_to = _source_admin_user_id;

  -- Optionally reset unpaid leads to 'new'
  IF COALESCE(_reset_to_new, false) THEN
    UPDATE public.sales_leads
       SET status = 'new'
     WHERE assigned_to = _target_admin_user_id
       AND is_paid = false
       AND id IN (SELECT lead_id FROM public.agent_offboarding_lead_snapshots WHERE event_id = v_event_id);
  END IF;

  -- Reassign outstanding reminders
  WITH r AS (
    UPDATE public.lead_reminders
       SET assigned_to = _target_admin_user_id
     WHERE assigned_to = _source_admin_user_id
       AND is_completed = false
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_reminder_count FROM r;

  -- Optionally freeze the departing agent
  IF COALESCE(_also_deactivate, false) THEN
    UPDATE public.admin_users SET is_active = false WHERE id = _source_admin_user_id;
  END IF;

  UPDATE public.agent_offboarding_events
     SET lead_count = v_lead_count,
         paid_lead_count = v_paid_count,
         reminder_count = v_reminder_count
   WHERE id = v_event_id;

  RETURN jsonb_build_object(
    'event_id', v_event_id,
    'lead_count', v_lead_count,
    'paid_lead_count', v_paid_count,
    'reminder_count', v_reminder_count
  );
END $$;

GRANT EXECUTE ON FUNCTION public.create_agent_offboarding_backup(UUID, UUID, BOOLEAN, BOOLEAN, TEXT) TO authenticated;

-- Restore: put every lead back on its original owner (or a chosen target) using the snapshot
CREATE OR REPLACE FUNCTION public.restore_agent_offboarding_backup(
  _event_id UUID,
  _restore_to_admin_user_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.agent_offboarding_events%ROWTYPE;
  v_caller_admin_id UUID;
  v_restored INT := 0;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF NOT public.is_management(auth.uid()) THEN
    RAISE EXCEPTION 'Only management can restore offboarding backups';
  END IF;

  SELECT id INTO v_caller_admin_id FROM public.admin_users WHERE user_id = auth.uid() LIMIT 1;

  SELECT * INTO v_event FROM public.agent_offboarding_events WHERE id = _event_id;
  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'Backup event not found';
  END IF;

  -- Restore each lead to its original assignee, status and is_paid values
  WITH r AS (
    UPDATE public.sales_leads sl
       SET assigned_to = COALESCE(_restore_to_admin_user_id, s.original_assigned_to),
           status = s.original_status,
           assigned_at = v_now,
           last_activity_date = v_now
      FROM public.agent_offboarding_lead_snapshots s
     WHERE s.event_id = _event_id
       AND sl.id = s.lead_id
    RETURNING sl.id
  )
  SELECT COUNT(*) INTO v_restored FROM r;

  -- Reactivate the source agent if we froze them
  IF v_event.also_deactivated AND _restore_to_admin_user_id IS NULL THEN
    UPDATE public.admin_users SET is_active = true WHERE id = v_event.source_admin_user_id;
  END IF;

  UPDATE public.agent_offboarding_events
     SET restored_at = v_now,
         restored_by = v_caller_admin_id,
         restored_lead_count = v_restored
   WHERE id = _event_id;

  RETURN jsonb_build_object('restored', v_restored, 'event_id', _event_id);
END $$;

GRANT EXECUTE ON FUNCTION public.restore_agent_offboarding_backup(UUID, UUID) TO authenticated;
