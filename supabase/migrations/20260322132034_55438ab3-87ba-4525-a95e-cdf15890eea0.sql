-- Add is_callback column to sales_leads
ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS is_callback boolean DEFAULT false;

-- Backfill: mark leads as callbacks if their abandoned_cart has request_type = 'urgent_callback'
UPDATE public.sales_leads sl
SET is_callback = true
FROM public.abandoned_carts ac
WHERE sl.abandoned_cart_id = ac.id
  AND (ac.cart_metadata->>'request_type') = 'urgent_callback';

-- Also mark any leads with status 'urgent_callback' as callbacks
UPDATE public.sales_leads
SET is_callback = true
WHERE status = 'urgent_callback';

-- Update recover_orphaned_leads to set is_callback for callback carts
CREATE OR REPLACE FUNCTION public.recover_orphaned_leads()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart RECORD;
  v_count INTEGER := 0;
  v_skipped INTEGER := 0;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_clean_email TEXT;
  v_existing_id UUID;
  v_terminal_id UUID;
  v_assigned_agent UUID;
  v_is_recent BOOLEAN;
  v_is_callback BOOLEAN;
BEGIN
  PERFORM reset_daily_caps();

  FOR v_cart IN
    SELECT ac.*
    FROM abandoned_carts ac
    WHERE ac.email IS NOT NULL
      AND btrim(ac.email) != ''
      AND ac.step_abandoned >= 2
      AND (ac.is_converted IS NULL OR ac.is_converted = false)
      AND NOT EXISTS (
        SELECT 1 FROM sales_leads sl WHERE sl.abandoned_cart_id = ac.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM sales_leads sl
        WHERE lower(btrim(sl.email)) = lower(btrim(ac.email))
      )
    ORDER BY ac.created_at ASC
  LOOP
    v_clean_email := lower(btrim(v_cart.email));
    v_full_name := NULLIF(btrim(COALESCE(v_cart.full_name, '')), '');
    v_is_recent := (v_cart.created_at >= (now() - interval '2 days'));
    v_is_callback := COALESCE((v_cart.cart_metadata->>'request_type') = 'urgent_callback', false);

    IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
      v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
      v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
    ELSE
      v_first_name := NULL;
      v_last_name := NULL;
    END IF;

    IF NOT v_is_recent THEN
      SELECT id INTO v_terminal_id
      FROM sales_leads
      WHERE lower(btrim(email)) = v_clean_email
        AND status IN ('converted', 'lost', 'fake_lead')
      LIMIT 1;

      IF v_terminal_id IS NOT NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
    END IF;

    BEGIN
      v_assigned_agent := public.get_next_sales_user();
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        v_assigned_agent := public.get_next_eligible_agent();
      EXCEPTION WHEN OTHERS THEN
        v_assigned_agent := NULL;
      END;
    END;

    BEGIN
      INSERT INTO public.sales_leads (
        first_name, last_name, email, phone, lead_source, status, priority,
        vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
        mileage, plan_interest, cart_value, step_two_completed_at,
        abandoned_cart_id, created_at, updated_at, last_activity_date,
        resubmission_count, assigned_to, assigned_at, is_callback
      ) VALUES (
        v_first_name, v_last_name, v_clean_email, NULLIF(btrim(v_cart.phone), ''),
        'website',
        CASE WHEN v_is_callback THEN 'urgent_callback' ELSE 'new' END,
        CASE WHEN v_is_callback THEN 'high' ELSE 'medium' END,
        NULLIF(btrim(v_cart.vehicle_reg), ''), NULLIF(btrim(v_cart.vehicle_make), ''),
        NULLIF(btrim(v_cart.vehicle_model), ''), NULLIF(btrim(v_cart.vehicle_year), ''),
        NULLIF(btrim(v_cart.vehicle_type), ''),
        NULLIF(btrim(v_cart.mileage), ''), v_cart.plan_name, v_cart.total_price,
        CASE WHEN COALESCE(v_cart.step_abandoned, 0) >= 2 THEN now() ELSE NULL END,
        v_cart.id, now(), now(), now(),
        0, v_assigned_agent, CASE WHEN v_assigned_agent IS NOT NULL THEN now() ELSE NULL END,
        v_is_callback
      );

      IF v_assigned_agent IS NOT NULL THEN
        UPDATE agent_distribution_caps
        SET assigned_today = assigned_today + 1,
            last_assigned_at = now(),
            updated_at = now()
        WHERE admin_user_id = v_assigned_agent;
      END IF;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO system_event_logs (event_type, event_source, event_data, error_message)
      VALUES ('lead_recovery_error', 'recover_orphaned_leads', 
        jsonb_build_object('cart_id', v_cart.id, 'email', v_clean_email),
        SQLERRM);
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  INSERT INTO system_event_logs (event_type, event_source, event_data)
  VALUES ('lead_recovery_run', 'recover_orphaned_leads',
    jsonb_build_object('recovered', v_count, 'skipped', v_skipped, 'ran_at', now()));

  RETURN jsonb_build_object('success', true, 'recovered', v_count, 'skipped', v_skipped);
END;
$$;