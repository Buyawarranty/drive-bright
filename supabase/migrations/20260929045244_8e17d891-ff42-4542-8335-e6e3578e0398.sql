CREATE OR REPLACE FUNCTION public.agent_works_renewals(p_admin_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lead_team_members ltm
    JOIN public.admin_users au ON au.id = ltm.admin_user_id
    LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = au.id
    WHERE ltm.admin_user_id = p_admin_user_id
      AND ltm.workstream_renewals = true
      AND au.is_active = true
      AND au.archived_at IS NULL
      AND au.role IN ('sales', 'sales_lead')
      AND COALESCE(adc.paused, false) = false
  )
  AND NOT public.agent_on_leave(p_admin_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.agent_works_renewals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_works_renewals(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.create_renewal_lead_for_policy(p_policy_id uuid, p_force boolean DEFAULT false, p_actor uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p RECORD;
  v_c RECORD;
  v_year integer;
  v_existing uuid;
  v_open_lead uuid;
  v_owner uuid;
  v_reason text := 'renewals_round_robin';
  v_lead_id uuid;
  v_phone_tail text;
  v_email text;
  v_days integer;
  v_block text;
BEGIN
  SELECT * INTO v_p FROM public.customer_policies WHERE id = p_policy_id;
  IF v_p.id IS NULL THEN RETURN NULL; END IF;
  IF lower(COALESCE(v_p.status,'')) IN
     ('cancelled','canceled','refunded','partially_refunded','expired','voided','deleted','chargeback') THEN
    RETURN NULL;
  END IF;

  v_block := public.renewal_blocked_reason(v_p.customer_id);
  IF v_block IS NOT NULL AND NOT p_force THEN RETURN NULL; END IF;

  v_year := EXTRACT(YEAR FROM v_p.policy_end_date)::int;

  SELECT lead_id INTO v_existing FROM public.renewal_lead_links
   WHERE policy_id = p_policy_id AND renewal_year = v_year;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT * INTO v_c FROM public.customers WHERE id = v_p.customer_id;
  v_email := NULLIF(lower(btrim(COALESCE(v_c.email, ''))), '');
  v_phone_tail := NULLIF(RIGHT(COALESCE(public.normalize_uk_phone(v_c.phone), ''), 9), '');
  IF v_email IS NULL AND v_phone_tail IS NULL THEN RETURN NULL; END IF;

  v_days := (v_p.policy_end_date::date - CURRENT_DATE);

  SELECT sl.id INTO v_open_lead
  FROM public.sales_leads sl
  WHERE sl.status NOT IN ('lost','converted','fake_lead','do_not_contact','archived')
    AND ((v_email IS NOT NULL AND lower(btrim(COALESCE(sl.email,''))) = v_email)
      OR (v_phone_tail IS NOT NULL AND RIGHT(COALESCE(public.normalize_uk_phone(sl.phone),''), 9) = v_phone_tail))
  ORDER BY sl.updated_at DESC
  LIMIT 1;

  IF v_open_lead IS NOT NULL THEN
    UPDATE public.sales_leads
       SET notes = COALESCE(notes || E'\n', '') ||
                   'RENEWAL DUE — policy ' || COALESCE(v_p.policy_number,'') || ' expires ' ||
                   to_char(v_p.policy_end_date, 'DD Mon YYYY') ||
                   CASE WHEN v_days >= 0 THEN ' (' || v_days || ' days).' ELSE ' (' || abs(v_days) || ' days overdue).' END,
           last_resubmitted_at = now(),
           updated_at = now()
     WHERE id = v_open_lead;
    INSERT INTO public.renewal_lead_links (policy_id, renewal_year, lead_id, customer_id, assigned_to, assignment_reason, attached_to_existing, created_by)
    VALUES (p_policy_id, v_year, v_open_lead, v_p.customer_id,
            (SELECT assigned_to FROM public.sales_leads WHERE id = v_open_lead), 'attached_to_open_lead', true, p_actor);
    RETURN v_open_lead;
  END IF;

  v_owner := public.resolve_sale_credit(
    v_c.sale_credit_admin_user_id, v_p.payment_confirmed_by, v_p.quote_sent_by, v_c.assigned_to);

  IF v_owner IS NOT NULL AND public.agent_works_renewals(v_owner) THEN
    v_reason := 'original_seller';
  ELSE
    v_owner := NULL;
  END IF;

  IF v_owner IS NULL THEN
    SELECT au.id INTO v_owner
    FROM public.admin_users au
    JOIN public.lead_team_members ltm ON ltm.admin_user_id = au.id
    LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = au.id
    WHERE ltm.workstream_renewals = true
      AND au.is_active = true
      AND au.archived_at IS NULL
      AND au.role IN ('sales','sales_lead')
      AND COALESCE(adc.paused, false) = false
      AND NOT public.agent_on_leave(au.id)
    ORDER BY adc.last_assigned_at ASC NULLS FIRST, adc.sort_order ASC NULLS LAST, au.created_at ASC
    LIMIT 1
    FOR UPDATE OF adc SKIP LOCKED;
  END IF;

  INSERT INTO public.sales_leads (
    first_name, last_name, email, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage,
    status, priority, lead_source, original_source, notes, auto_tags,
    assigned_to, assigned_at, manual_entry, last_resubmitted_at
  ) VALUES (
    COALESCE(v_c.first_name, split_part(COALESCE(v_c.name,''), ' ', 1)),
    COALESCE(v_c.last_name, NULLIF(regexp_replace(COALESCE(v_c.name,''), '^\S+\s*', ''), '')),
    COALESCE(v_c.email, ''), v_c.phone, v_c.registration_plate, v_c.vehicle_make, v_c.vehicle_model,
    v_c.vehicle_year, v_c.mileage,
    'new', 'high', 'other', 'renewal',
    'RENEWAL — policy ' || COALESCE(v_p.policy_number,'') || ' (' || COALESCE(v_p.plan_type,'') ||
      ') ' || CASE WHEN v_days >= 0 THEN 'expires ' || to_char(v_p.policy_end_date, 'DD Mon YYYY') || ', ' || v_days || ' days away.'
                   ELSE 'expired ' || to_char(v_p.policy_end_date, 'DD Mon YYYY') || ', ' || abs(v_days) || ' days overdue.' END,
    ARRAY['Renewal']::text[],
    v_owner, CASE WHEN v_owner IS NOT NULL THEN now() ELSE NULL END,
    v_owner IS NOT NULL, now()
  ) RETURNING id INTO v_lead_id;

  IF v_owner IS NOT NULL AND v_reason = 'renewals_round_robin' THEN
    UPDATE public.agent_distribution_caps
       SET last_assigned_at = now(), updated_at = now()
     WHERE admin_user_id = v_owner;
  END IF;

  INSERT INTO public.renewal_lead_links (policy_id, renewal_year, lead_id, customer_id, assigned_to, assignment_reason, created_by)
  VALUES (p_policy_id, v_year, v_lead_id, v_p.customer_id, v_owner, v_reason, p_actor);

  RETURN v_lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_renewal_leads(p_days integer DEFAULT 60)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_made integer := 0;
  v_lead uuid;
BEGIN
  FOR r IN
    SELECT cp.id
    FROM public.customer_policies cp
    WHERE cp.policy_end_date::date BETWEEN (CURRENT_DATE - 180) AND (CURRENT_DATE + p_days)
      AND lower(COALESCE(cp.status,'')) NOT IN
          ('cancelled','canceled','refunded','partially_refunded','expired','voided','deleted','chargeback')
      AND COALESCE(cp.is_deleted, false) = false
      AND public.renewal_blocked_reason(cp.customer_id) IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.renewal_lead_links rl
        WHERE rl.policy_id = cp.id
          AND rl.renewal_year = EXTRACT(YEAR FROM cp.policy_end_date)::int
      )
    ORDER BY cp.policy_end_date ASC
    LIMIT 500
  LOOP
    v_lead := public.create_renewal_lead_for_policy(r.id, false, NULL);
    IF v_lead IS NOT NULL THEN v_made := v_made + 1; END IF;
  END LOOP;
  RETURN v_made;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_renewal_lead_for_policy(uuid, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_renewal_lead_for_policy(uuid, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_renewal_leads(integer) TO service_role;