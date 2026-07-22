
-- Prompt 14: Manager overrides + audit log

-- 1) Audit table
CREATE TABLE IF NOT EXISTS public.orr_manager_overrides (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           uuid,
  phone_normalized  text,
  manager_id        uuid NOT NULL,
  override_type     text NOT NULL,        -- reassign | release_lock | correct_attempt | correct_next_eligible | move_queue | correct_owner | refused_dnc
  reason            text NOT NULL,
  previous_value    jsonb,
  new_value         jsonb,
  previous_owner_id uuid,
  new_owner_id      uuid,
  allowed_extra_call boolean NOT NULL DEFAULT false,
  refused            boolean NOT NULL DEFAULT false,
  refused_reason     text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.orr_manager_overrides TO authenticated;
GRANT ALL   ON public.orr_manager_overrides TO service_role;

ALTER TABLE public.orr_manager_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers and admins can view override log"
  ON public.orr_manager_overrides;
CREATE POLICY "Managers and admins can view override log"
  ON public.orr_manager_overrides
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
        AND COALESCE(is_active,true) = true
        AND role::text IN ('admin','super_admin','sales_manager','sales_lead','sales')
    )
  );
-- No INSERT/UPDATE/DELETE policies → only service_role (via the RPC below) may write.

CREATE INDEX IF NOT EXISTS idx_orr_overrides_lead     ON public.orr_manager_overrides(lead_id);
CREATE INDEX IF NOT EXISTS idx_orr_overrides_phone    ON public.orr_manager_overrides(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_orr_overrides_manager  ON public.orr_manager_overrides(manager_id);
CREATE INDEX IF NOT EXISTS idx_orr_overrides_type     ON public.orr_manager_overrides(override_type);
CREATE INDEX IF NOT EXISTS idx_orr_overrides_created  ON public.orr_manager_overrides(created_at DESC);

-- 2) Central override RPC
CREATE OR REPLACE FUNCTION public.orr_manager_override(
  _manager_id     uuid,
  _lead_id        uuid,
  _override_type  text,                  -- reassign | release_lock | correct_attempt | correct_next_eligible | move_queue | correct_owner
  _reason         text,
  _new_value      jsonb DEFAULT NULL,    -- flexible payload per override_type
  _allow_extra_call boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_lead record;
  v_prev jsonb;
  v_prev_owner uuid;
  v_new_owner  uuid;
  v_refused boolean := false;
  v_refused_reason text;
BEGIN
  IF _manager_id IS NULL OR _lead_id IS NULL OR _override_type IS NULL
     OR _reason IS NULL OR length(btrim(_reason)) = 0 THEN
    RAISE EXCEPTION 'orr_manager_override: manager_id, lead_id, override_type and reason are required';
  END IF;

  -- Manager gate
  SELECT role::text INTO v_role
  FROM public.admin_users
  WHERE user_id = _manager_id AND COALESCE(is_active,true) = true
  LIMIT 1;

  IF v_role NOT IN ('admin','super_admin','sales_manager') THEN
    RAISE EXCEPTION 'orr_manager_override: not authorised (role=%). Only admin/super_admin/sales_manager may override.', v_role;
  END IF;

  SELECT * INTO v_lead FROM public.sales_leads WHERE id = _lead_id;
  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'orr_manager_override: lead % not found', _lead_id;
  END IF;

  v_prev_owner := v_lead.assigned_to;

  -- Hard blocks: DNC / opted-out / wrong number / legal suppression cannot be overridden.
  IF v_lead.status IN ('do_not_contact','wrong_number')
     OR EXISTS (
       SELECT 1 FROM public.lead_customers
       WHERE phone_normalized = v_lead.phone_normalized
         AND (do_not_call = true OR lock_state = 'do_not_call')
     ) THEN
    v_refused := true;
    v_refused_reason := 'Blocked: Do Not Call / Opted Out / Wrong Number / legal suppression cannot be overridden.';

    INSERT INTO public.orr_manager_overrides
      (lead_id, phone_normalized, manager_id, override_type, reason,
       previous_value, new_value, previous_owner_id, new_owner_id,
       allowed_extra_call, refused, refused_reason)
    VALUES
      (_lead_id, v_lead.phone_normalized, _manager_id, 'refused_dnc', _reason,
       jsonb_build_object('status', v_lead.status), _new_value,
       v_prev_owner, NULL, false, true, v_refused_reason);

    RETURN jsonb_build_object('ok', false, 'refused', true, 'reason', v_refused_reason);
  END IF;

  -- Apply the requested override
  CASE _override_type
    WHEN 'reassign' THEN
      v_new_owner := (_new_value->>'new_owner_id')::uuid;
      IF v_new_owner IS NULL THEN
        RAISE EXCEPTION 'reassign requires new_value.new_owner_id';
      END IF;
      v_prev := jsonb_build_object('assigned_to', v_prev_owner,
                                   'orr_locked_until', v_lead.orr_locked_until);
      UPDATE public.sales_leads
      SET assigned_to = v_new_owner,
          orr_locked_until = NULL,
          orr_first_call_deadline = NULL,
          orr_retry_deadline = NULL,
          updated_at = now()
      WHERE id = _lead_id;

      UPDATE public.lead_customers
      SET lock_owner = v_new_owner, lock_agent_id = v_new_owner, lock_lead_id = _lead_id,
          lock_state = 'contacted_owned', lock_state_at = now(), updated_at = now()
      WHERE phone_normalized = v_lead.phone_normalized;

    WHEN 'release_lock' THEN
      v_prev := jsonb_build_object(
        'orr_locked_until', v_lead.orr_locked_until,
        'orr_first_call_deadline', v_lead.orr_first_call_deadline,
        'orr_retry_deadline', v_lead.orr_retry_deadline,
        'assigned_to', v_prev_owner);
      UPDATE public.sales_leads
      SET orr_locked_until = NULL,
          orr_first_call_deadline = NULL,
          orr_retry_deadline = NULL,
          updated_at = now()
      WHERE id = _lead_id;

      -- Best-effort: clear customer-level lock if it's held by this lead.
      UPDATE public.lead_customers
      SET lock_state = 'eligible', lock_state_at = now(),
          lock_lead_id = NULL, lock_agent_id = NULL, lock_owner = NULL,
          lock_until = NULL, updated_at = now()
      WHERE phone_normalized = v_lead.phone_normalized
        AND lock_lead_id = _lead_id;

    WHEN 'correct_attempt' THEN
      v_prev := jsonb_build_object('orr_attempt_count', v_lead.orr_attempt_count);
      UPDATE public.sales_leads
      SET orr_attempt_count = GREATEST(0, LEAST(7, COALESCE((_new_value->>'attempt_count')::int, orr_attempt_count))),
          updated_at = now()
      WHERE id = _lead_id;

    WHEN 'correct_next_eligible' THEN
      v_prev := jsonb_build_object('orr_next_release_at', v_lead.orr_next_release_at);
      UPDATE public.sales_leads
      SET orr_next_release_at = (_new_value->>'next_eligible_at')::timestamptz,
          orr_locked_until    = (_new_value->>'next_eligible_at')::timestamptz,
          updated_at = now()
      WHERE id = _lead_id;

    WHEN 'move_queue' THEN
      v_prev := jsonb_build_object(
        'orr_pool_state', v_lead.orr_pool_state,
        'orr_pool_kind',  v_lead.orr_pool_kind,
        'orr_pool_next_open_at', v_lead.orr_pool_next_open_at);
      UPDATE public.sales_leads
      SET orr_pool_state       = _new_value->>'pool_state',
          orr_pool_kind        = _new_value->>'pool_kind',
          orr_pool_next_open_at= (_new_value->>'pool_next_open_at')::timestamptz,
          orr_pool_since       = now(),
          updated_at           = now()
      WHERE id = _lead_id;

    WHEN 'correct_owner' THEN
      v_new_owner := (_new_value->>'new_owner_id')::uuid;
      v_prev := jsonb_build_object('assigned_to', v_prev_owner);
      UPDATE public.sales_leads
      SET assigned_to = v_new_owner, updated_at = now()
      WHERE id = _lead_id;

    ELSE
      RAISE EXCEPTION 'orr_manager_override: unknown override_type %', _override_type;
  END CASE;

  INSERT INTO public.orr_manager_overrides
    (lead_id, phone_normalized, manager_id, override_type, reason,
     previous_value, new_value, previous_owner_id, new_owner_id, allowed_extra_call)
  VALUES
    (_lead_id, v_lead.phone_normalized, _manager_id, _override_type, _reason,
     v_prev, _new_value, v_prev_owner, COALESCE(v_new_owner, v_prev_owner), _allow_extra_call);

  INSERT INTO public.lead_assignment_audit(lead_id, assigned_to_id, assignment_type, reason)
  VALUES (_lead_id, COALESCE(v_new_owner, v_prev_owner), 'open_round_robin',
          'orr_manager_override_' || _override_type);

  RETURN jsonb_build_object('ok', true, 'override_type', _override_type,
                            'previous_value', v_prev, 'new_value', _new_value);
END;
$$;

GRANT EXECUTE ON FUNCTION public.orr_manager_override(uuid,uuid,text,text,jsonb,boolean) TO authenticated, service_role;
