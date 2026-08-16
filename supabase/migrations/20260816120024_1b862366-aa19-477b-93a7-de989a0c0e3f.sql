-- ORR intake classification must not park live leads while ORR is switched off.
CREATE OR REPLACE FUNCTION public.sales_leads_classify_intake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team_blue uuid;
  v_is_blue   boolean := false;
  v_enabled   boolean := false;
  v_res       record;
BEGIN
  IF NEW.intake_class IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_team_blue FROM public.lead_teams WHERE lower(name) = 'blue' LIMIT 1;
  IF v_team_blue IS NULL THEN RETURN NEW; END IF;

  IF NEW.team_id = v_team_blue THEN
    v_is_blue := true;
  ELSIF NEW.assigned_to IS NOT NULL AND public.is_agent_on_team_blue(NEW.assigned_to) THEN
    v_is_blue := true;
  END IF;

  IF NOT v_is_blue THEN RETURN NEW; END IF;

  -- Only hold leads for the ORR release window when ORR is actually enabled
  -- for Team Blue (or globally). Otherwise leads stay live for normal rotation.
  SELECT COALESCE(bool_or(open_round_robin_enabled), false)
    INTO v_enabled
  FROM public.lead_distribution_settings
  WHERE team_id = v_team_blue OR team_id IS NULL;

  IF NOT v_enabled THEN
    NEW.intake_class := 'live';
    NEW.eligible_at  := COALESCE(NEW.created_at, now());
    RETURN NEW;
  END IF;

  SELECT * INTO v_res FROM public.orr_classify_intake(COALESCE(NEW.created_at, now()));
  NEW.intake_class := v_res.intake_class;
  NEW.eligible_at  := v_res.eligible_at;
  RETURN NEW;
END;
$function$;

-- Release anything currently parked for a future ORR window.
UPDATE public.sales_leads
SET intake_class = 'live',
    eligible_at = now()
WHERE intake_class = 'overnight'
  AND (eligible_at IS NULL OR eligible_at > now())
  AND status NOT IN ('converted','lost','fake_lead','archived');
