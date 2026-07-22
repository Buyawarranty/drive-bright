
-- 1) Guard the status RPC: only the assigned agent can move new → contacted.
CREATE OR REPLACE FUNCTION public.update_lead_status(
  p_lead_id uuid,
  p_status text,
  p_is_abandoned_cart boolean DEFAULT false,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_admin_id UUID;
    v_now timestamp with time zone := now();
    v_rows_affected INT;
    v_current_status text;
    v_assigned_to UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT id INTO v_caller_admin_id
    FROM admin_users
    WHERE user_id = v_caller_id AND is_active = true
    LIMIT 1;

    IF v_caller_admin_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;

    IF p_is_abandoned_cart THEN
        UPDATE abandoned_carts
        SET contact_status = p_status,
            is_converted = CASE WHEN p_status IN ('lost', 'fake_lead', 'converted') THEN true ELSE is_converted END,
            updated_at = v_now
        WHERE id = p_lead_id;
        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    ELSE
        -- Fetch current state so we can enforce the assigned-agent rule.
        SELECT status::text, assigned_to
          INTO v_current_status, v_assigned_to
        FROM sales_leads
        WHERE id = p_lead_id
        FOR UPDATE;

        IF v_current_status IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
        END IF;

        -- HARD RULE: only the currently assigned agent can move a lead
        -- from "new" (Not spoken to) to "contacted" (Spoken to).
        -- Managers who need to correct ownership must use orr_manager_override.
        IF p_status = 'contacted'
           AND v_current_status = 'new'
           AND (v_assigned_to IS DISTINCT FROM v_caller_admin_id) THEN
            RETURN jsonb_build_object(
              'success', false,
              'error', 'Only the assigned agent can mark this lead as Spoken to'
            );
        END IF;

        UPDATE sales_leads
        SET status = p_status::lead_status,
            last_activity_date = v_now,
            converted_at = CASE WHEN p_status = 'converted' THEN v_now ELSE converted_at END,
            lost_at = CASE WHEN p_status = 'lost' THEN v_now ELSE lost_at END,
            updated_at = v_now
        WHERE id = p_lead_id;
        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    END IF;

    IF v_rows_affected = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
    END IF;

    RETURN jsonb_build_object('success', true, 'rows_affected', v_rows_affected);
END;
$$;

-- 2) Clean up the misleading "new → contacted by info@buyawarranty.co.uk" notes
--    that were written today by the manager account. These are false because
--    the assigned agent (e.g. Thomas) never actually spoke to the customer.
DELETE FROM public.lead_quick_notes
WHERE created_at >= '2026-07-22'::date
  AND note_text ILIKE 'Status changed: new → contacted by info@buyawarranty.co.uk%';
