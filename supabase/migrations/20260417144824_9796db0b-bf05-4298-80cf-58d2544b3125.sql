CREATE OR REPLACE FUNCTION public.migrate_orphan_carts_to_leads()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_migrated INTEGER := 0;
  v_merged INTEGER := 0;
  v_skipped INTEGER := 0;
  v_cart RECORD;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_clean_email TEXT;
  v_clean_phone TEXT;
  v_derived_source lead_source;
  v_dedup_lead_id UUID;
  v_terminal_lead_id UUID;
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
      AND ac.email IS NOT NULL
      AND btrim(ac.email) != ''
    ORDER BY ac.created_at DESC
  LOOP
    v_clean_email := lower(btrim(v_cart.email));
    v_clean_phone := regexp_replace(COALESCE(v_cart.phone, ''), '[^0-9]', '', 'g');

    v_full_name := NULLIF(btrim(COALESCE(v_cart.full_name, '')), '');
    IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
      v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
      v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
    ELSE
      v_first_name := NULL;
      v_last_name := NULL;
    END IF;

    v_derived_source := public.derive_lead_source(v_cart.cart_metadata);

    BEGIN
      v_dedup_lead_id := NULL;

      IF length(v_clean_phone) >= 10 THEN
        SELECT id INTO v_dedup_lead_id
        FROM public.sales_leads
        WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
          AND status NOT IN ('converted', 'lost', 'fake_lead')
          AND (created_at > now() - interval '30 days' OR assigned_to IS NOT NULL OR call_count > 0 OR notes IS NOT NULL)
        ORDER BY CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END, created_at DESC
        LIMIT 1;
      END IF;

      IF v_dedup_lead_id IS NULL THEN
        SELECT id INTO v_dedup_lead_id
        FROM public.sales_leads
        WHERE lower(btrim(email)) = v_clean_email
          AND status NOT IN ('converted', 'lost', 'fake_lead')
          AND (created_at > now() - interval '30 days' OR assigned_to IS NOT NULL OR call_count > 0 OR notes IS NOT NULL)
        ORDER BY CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END, created_at DESC
        LIMIT 1;
      END IF;

      IF v_dedup_lead_id IS NOT NULL THEN
        UPDATE public.sales_leads
        SET
          email = v_clean_email,
          phone = COALESCE(NULLIF(btrim(v_cart.phone), ''), phone),
          first_name = COALESCE(NULLIF(v_first_name, ''), first_name),
          last_name = COALESCE(v_last_name, last_name),
          vehicle_reg = COALESCE(NULLIF(btrim(v_cart.vehicle_reg), ''), vehicle_reg),
          vehicle_make = COALESCE(NULLIF(btrim(v_cart.vehicle_make), ''), vehicle_make),
          vehicle_model = COALESCE(NULLIF(btrim(v_cart.vehicle_model), ''), vehicle_model),
          vehicle_year = COALESCE(NULLIF(btrim(v_cart.vehicle_year), ''), vehicle_year),
          vehicle_type = COALESCE(NULLIF(btrim(v_cart.vehicle_type), ''), vehicle_type),
          mileage = COALESCE(NULLIF(btrim(v_cart.mileage), ''), mileage),
          plan_interest = COALESCE(v_cart.plan_name, plan_interest),
          cart_value = COALESCE(v_cart.total_price, cart_value),
          abandoned_cart_id = COALESCE(abandoned_cart_id, v_cart.id),
          lead_source = CASE WHEN v_derived_source != 'website' THEN v_derived_source ELSE lead_source END,
          last_activity_date = now(),
          resubmission_count = COALESCE(resubmission_count, 0) + 1,
          last_resubmitted_at = now(),
          updated_at = now()
        WHERE id = v_dedup_lead_id;

        UPDATE public.abandoned_carts
        SET contacted_by = sl.assigned_to
        FROM public.sales_leads sl
        WHERE abandoned_carts.id = v_cart.id
          AND sl.id = v_dedup_lead_id
          AND sl.assigned_to IS NOT NULL;

        v_merged := v_merged + 1;
        CONTINUE;
      END IF;

      v_terminal_lead_id := NULL;
      IF length(v_clean_phone) >= 10 THEN
        SELECT id INTO v_terminal_lead_id
        FROM public.sales_leads
        WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
          AND status IN ('converted', 'lost', 'fake_lead')
        LIMIT 1;
      END IF;
      IF v_terminal_lead_id IS NULL THEN
        SELECT id INTO v_terminal_lead_id
        FROM public.sales_leads
        WHERE lower(btrim(email)) = v_clean_email
          AND status IN ('converted', 'lost', 'fake_lead')
        LIMIT 1;
      END IF;
      IF v_terminal_lead_id IS NOT NULL AND v_derived_source NOT IN ('google_ad', 'social_ad') THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      PERFORM reset_daily_caps();
      v_assigned_agent := public.get_next_sales_user();

      INSERT INTO sales_leads (
        first_name, last_name, email, phone, lead_source, status, priority,
        vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
        mileage, plan_interest, cart_value, abandoned_cart_id,
        created_at, updated_at, last_activity_date,
        assigned_to, assigned_at
      ) VALUES (
        v_first_name, v_last_name, v_clean_email,
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
        COALESCE(v_cart.created_at, now()), now(), now(),
        v_assigned_agent,
        CASE WHEN v_assigned_agent IS NOT NULL THEN now() ELSE NULL END
      );

      IF v_assigned_agent IS NOT NULL THEN
        UPDATE public.agent_distribution_caps
        SET assigned_today = assigned_today + 1, last_assigned_at = now(), updated_at = now()
        WHERE admin_user_id = v_assigned_agent;

        UPDATE public.abandoned_carts
        SET contacted_by = v_assigned_agent
        WHERE id = v_cart.id;
      END IF;

      v_migrated := v_migrated + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO system_event_logs (event_type, event_source, event_data, error_message)
      VALUES ('orphan_migration_failed', 'migrate_orphan_carts_to_leads',
        jsonb_build_object('cart_id', v_cart.id, 'email', v_cart.email),
        SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'migrated', v_migrated, 'merged', v_merged, 'skipped', v_skipped);
END;
$$;