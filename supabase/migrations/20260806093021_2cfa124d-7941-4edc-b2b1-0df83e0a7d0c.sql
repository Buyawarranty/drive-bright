CREATE OR REPLACE FUNCTION public.auto_reassign_google_ad_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bypass text := current_setting('app.allow_reassign', true);
  v_worked boolean;
BEGIN
  -- Explicit manager-driven reassignment always wins
  IF v_bypass = 'on' AND NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.status = 'converted' AND NEW.lead_source = 'google_ad') THEN
    RETURN NEW;
  END IF;

  -- Sticky ownership: if an agent actually worked this lead, they keep it forever.
  -- (Deliberately does NOT treat "status <> new" as work, because conversion itself changes status.)
  SELECT
    COALESCE(NEW.call_count, 0) > 0
    OR COALESCE(NEW.manual_call_adjustment, 0) > 0
    OR NEW.last_contacted_at IS NOT NULL
    OR COALESCE(btrim(NEW.notes), '') <> ''
    OR EXISTS (SELECT 1 FROM public.lead_call_logs lcl WHERE lcl.lead_id = NEW.id::text)
    OR EXISTS (SELECT 1 FROM public.lead_quick_notes lqn WHERE lqn.lead_id = NEW.id)
    OR EXISTS (
      SELECT 1 FROM public.phone_events pe
      WHERE pe.lead_id = NEW.id::text AND pe.agent_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.lead_assignment_audit laa
      WHERE laa.lead_id = NEW.id
        AND laa.assignment_type IN ('manager_manual_assign', 'manual_assign', 'bulk_reassign')
    )
  INTO v_worked;

  IF v_worked THEN
    -- keep whatever owner it already has; if it was already cleared, restore the last known owner
    IF NEW.assigned_to IS NULL THEN
      SELECT laa.assigned_to_id INTO NEW.assigned_to
      FROM public.lead_assignment_audit laa
      WHERE laa.lead_id = NEW.id AND laa.assigned_to_id IS NOT NULL
      ORDER BY laa.created_at DESC
      LIMIT 1;
      IF NEW.assigned_to IS NOT NULL AND NEW.assigned_at IS NULL THEN
        NEW.assigned_at := now();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Untouched Google Ads self-serve conversion: goes back to Website (unassigned)
  NEW.assigned_to := NULL;
  NEW.assigned_at := NULL;
  RETURN NEW;
END;
$function$;

-- Backfill: restore owners on worked, converted google_ad leads that were wrongly cleared
UPDATE public.sales_leads sl
SET assigned_to = restored.assigned_to_id,
    assigned_at = COALESCE(sl.assigned_at, restored.created_at),
    updated_at = now()
FROM (
  SELECT DISTINCT ON (laa.lead_id) laa.lead_id, laa.assigned_to_id, laa.created_at
  FROM public.lead_assignment_audit laa
  WHERE laa.assigned_to_id IS NOT NULL
  ORDER BY laa.lead_id, laa.created_at DESC
) restored
WHERE sl.id = restored.lead_id
  AND sl.assigned_to IS NULL
  AND sl.status = 'converted'
  AND sl.lead_source = 'google_ad'
  AND (
    COALESCE(sl.call_count, 0) > 0
    OR COALESCE(sl.manual_call_adjustment, 0) > 0
    OR sl.last_contacted_at IS NOT NULL
  );