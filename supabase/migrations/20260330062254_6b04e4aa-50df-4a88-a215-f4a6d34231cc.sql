CREATE OR REPLACE FUNCTION public.migrate_orphan_carts_to_leads()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_migrated INTEGER := 0;
  v_cart RECORD;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_derived_source lead_source;
  v_assigned_agent UUID;
BEGIN
  FOR v_cart IN
    SELECT ac.*
    FROM abandoned_carts ac
    WHERE ac.is_converted = false
      AND NOT EXISTS (
        SELECT 1 FROM sales_leads sl WHERE sl.abandoned_cart_id = ac.id
      )
      AND COALESCE(ac.step_abandoned, 0) >= 2
    ORDER BY ac.created_at DESC
  LOOP
    -- Parse name
    v_full_name := NULLIF(btrim(COALESCE(v_cart.full_name, '')), '');
    IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
      v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
      v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
    ELSE
      v_first_name := NULL;
      v_last_name := NULL;
    END IF;

    -- Derive source
    v_derived_source := public.derive_lead_source(v_cart.cart_metadata);

    BEGIN
      INSERT INTO sales_leads (
        first_name, last_name, email, phone, lead_source, status, priority,
        vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
        mileage, plan_interest, cart_value, abandoned_cart_id,
        created_at, updated_at, last_activity_date
      ) VALUES (
        v_first_name, v_last_name, lower(btrim(v_cart.email)),
        NULLIF(btrim(v_cart.phone), ''),
        v_derived_source,
        CASE WHEN v_cart.contact_status = 'contacted' THEN 'contacted'::lead_status ELSE 'new'::lead_status END,
        'medium',
        NULLIF(btrim(v_cart.vehicle_reg), ''),
        NULLIF(btrim(v_cart.vehicle_make), ''),
        NULLIF(btrim(v_cart.vehicle_model), ''),
        NULLIF(btrim(v_cart.vehicle_year), ''),
        NULLIF(btrim(v_cart.vehicle_type), ''),
        NULLIF(btrim(v_cart.mileage), ''),
        v_cart.plan_name, v_cart.total_price, v_cart.id,
        COALESCE(v_cart.created_at, now()), now(), now()
      );
      v_migrated := v_migrated + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Log and continue
      INSERT INTO system_event_logs (event_type, event_source, event_data, error_message)
      VALUES ('orphan_migration_failed', 'migrate_orphan_carts_to_leads',
        jsonb_build_object('cart_id', v_cart.id, 'email', v_cart.email),
        SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'migrated', v_migrated);
END;
$$;