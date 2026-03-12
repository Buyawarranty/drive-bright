
-- Fix get_next_sales_user to restore overflow recipient logic
-- The overflow section was accidentally removed in a previous migration
CREATE OR REPLACE FUNCTION public.get_next_sales_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_next_user_id uuid;
  v_last_user_id uuid;
  v_last_sort_order integer;
  v_last_overflow_id uuid;
  v_last_overflow_sort integer;
BEGIN
  PERFORM public.reset_daily_caps();

  -- Lock the round_robin_state row to prevent races
  SELECT last_assigned_user_id INTO v_last_user_id
  FROM public.round_robin_state
  ORDER BY updated_at DESC NULLS LAST, id DESC
  LIMIT 1
  FOR UPDATE;

  SELECT adc.sort_order INTO v_last_sort_order
  FROM public.agent_distribution_caps adc
  WHERE adc.admin_user_id = v_last_user_id;

  -- Find next primary agent by sort_order
  SELECT adc.admin_user_id INTO v_next_user_id
  FROM public.agent_distribution_caps adc
  JOIN public.admin_users au ON au.id = adc.admin_user_id
  WHERE au.is_active = true
    AND au.role IN ('sales', 'sales_lead')
    AND COALESCE(adc.paused, false) = false
    AND (adc.daily_cap IS NULL OR COALESCE(adc.assigned_today, 0) < adc.daily_cap)
    AND (v_last_sort_order IS NULL OR adc.sort_order > v_last_sort_order)
  ORDER BY adc.sort_order ASC NULLS LAST
  LIMIT 1;

  -- Wrap around
  IF v_next_user_id IS NULL THEN
    SELECT adc.admin_user_id INTO v_next_user_id
    FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
    WHERE au.is_active = true
      AND au.role IN ('sales', 'sales_lead')
      AND COALESCE(adc.paused, false) = false
      AND (adc.daily_cap IS NULL OR COALESCE(adc.assigned_today, 0) < adc.daily_cap)
    ORDER BY adc.sort_order ASC NULLS LAST
    LIMIT 1;
  END IF;

  -- Update round_robin_state pointer
  IF v_next_user_id IS NOT NULL THEN
    UPDATE public.round_robin_state
    SET last_assigned_user_id = v_next_user_id,
        updated_at = now()
    WHERE id = (
      SELECT id FROM public.round_robin_state
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 1
    );

    IF NOT FOUND THEN
      INSERT INTO public.round_robin_state (last_assigned_user_id, updated_at)
      VALUES (v_next_user_id, now());
    END IF;

    RETURN v_next_user_id;
  END IF;

  -- ALL PRIMARY AGENTS AT CAP: use overflow recipients in their own round-robin
  SELECT ors.last_assigned_overflow_id INTO v_last_overflow_id
  FROM public.overflow_round_robin_state ors
  LIMIT 1;

  SELECT o.sort_order INTO v_last_overflow_sort
  FROM public.overflow_recipients o
  WHERE o.id = v_last_overflow_id;

  -- Find next overflow recipient after last assigned
  SELECT o.admin_user_id, o.id INTO v_next_user_id, v_last_overflow_id
  FROM public.overflow_recipients o
  WHERE o.is_active = true
    AND (v_last_overflow_sort IS NULL OR o.sort_order > v_last_overflow_sort)
  ORDER BY o.sort_order ASC, o.id ASC
  LIMIT 1;

  -- Wrap around overflow
  IF v_next_user_id IS NULL THEN
    SELECT o.admin_user_id, o.id INTO v_next_user_id, v_last_overflow_id
    FROM public.overflow_recipients o
    WHERE o.is_active = true
    ORDER BY o.sort_order ASC, o.id ASC
    LIMIT 1;
  END IF;

  -- Update overflow round-robin state
  IF v_next_user_id IS NOT NULL THEN
    UPDATE public.overflow_round_robin_state
    SET last_assigned_overflow_id = v_last_overflow_id,
        updated_at = now();

    IF NOT FOUND THEN
      INSERT INTO public.overflow_round_robin_state (last_assigned_overflow_id, updated_at)
      VALUES (v_last_overflow_id, now());
    END IF;
  END IF;

  RETURN v_next_user_id;
END;
$function$;
