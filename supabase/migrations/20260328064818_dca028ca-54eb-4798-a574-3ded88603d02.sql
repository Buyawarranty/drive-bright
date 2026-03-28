
CREATE OR REPLACE FUNCTION public.recover_single_lead(p_cart_id uuid, p_agent_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cart RECORD;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_clean_email TEXT;
  v_existing_id UUID;
  v_assigned_agent UUID;
  v_is_callback BOOLEAN;
  v_derived_source lead_source;
  v_new_lead_id UUID;
BEGIN
  -- Reset daily caps
  PERFORM reset_daily_caps();

  -- Fetch the cart
  SELECT * INTO v_cart FROM abandoned_carts WHERE id = p_cart_id;
  IF v_cart IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cart not found');
  END IF;

  v_clean_email := lower(btrim(v_cart.email));

  -- Check if already exists in sales_leads
  SELECT id INTO v_existing_id FROM sales_leads
  WHERE abandoned_cart_id = p_cart_id
     OR lower(btrim(email)) = v_clean_email
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead already exists in pipeline', 'lead_id', v_existing_id);
  END IF;

  v_full_name := NULLIF(btrim(COALESCE(v_cart.full_name, '')), '');
  v_is_callback := COALESCE((v_cart.cart_metadata->>'request_type') = 'urgent_callback', false);
  v_derived_source := public.derive_lead_source(v_cart.cart_metadata);

  -- Parse name
  IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
    v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
    v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
  ELSE
    v_first_name := NULL;
    v_last_name := NULL;
  END IF;

  -- Determine agent: use provided agent_id or auto round-robin
  IF p_agent_id IS NOT NULL THEN
    v_assigned_agent := p_agent_id;
  ELSE
    v_assigned_agent := public.get_next_sales_user();
  END IF;

  -- Insert into sales_leads
  INSERT INTO public.sales_leads (
    first_name, last_name, email, phone, lead_source, status, priority,
    vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
    mileage, plan_interest, cart_value, step_two_completed_at,
    abandoned_cart_id, created_at, updated_at, last_activity_date,
    resubmission_count, assigned_to, assigned_at, is_callback
  ) VALUES (
    v_first_name, v_last_name, v_clean_email, NULLIF(btrim(v_cart.phone), ''),
    v_derived_source,
    (CASE WHEN v_is_callback THEN 'urgent_callback' ELSE 'new' END)::lead_status,
    CASE WHEN v_is_callback THEN 'high' ELSE 'medium' END,
    NULLIF(btrim(v_cart.vehicle_reg), ''), NULLIF(btrim(v_cart.vehicle_make), ''),
    NULLIF(btrim(v_cart.vehicle_model), ''), NULLIF(btrim(v_cart.vehicle_year), ''),
    NULLIF(btrim(v_cart.vehicle_type), ''),
    NULLIF(btrim(v_cart.mileage), ''), v_cart.plan_name, v_cart.total_price,
    CASE WHEN COALESCE(v_cart.step_abandoned, 0) >= 2 THEN now() ELSE NULL END,
    v_cart.id, now(), now(), now(),
    0, v_assigned_agent, CASE WHEN v_assigned_agent IS NOT NULL THEN now() ELSE NULL END,
    v_is_callback
  ) RETURNING id INTO v_new_lead_id;

  -- Update agent cap
  IF v_assigned_agent IS NOT NULL THEN
    UPDATE agent_distribution_caps
    SET assigned_today = assigned_today + 1,
        last_assigned_at = now(),
        updated_at = now()
    WHERE admin_user_id = v_assigned_agent;
  END IF;

  RETURN jsonb_build_object('success', true, 'lead_id', v_new_lead_id, 'assigned_to', v_assigned_agent);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO system_event_logs (event_type, event_source, event_data, error_message)
  VALUES ('single_lead_recovery_failed', 'recover_single_lead',
    jsonb_build_object('cart_id', p_cart_id, 'agent_id', p_agent_id),
    SQLERRM);
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
