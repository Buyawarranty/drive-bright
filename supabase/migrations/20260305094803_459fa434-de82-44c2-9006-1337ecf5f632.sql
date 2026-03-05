CREATE OR REPLACE FUNCTION public.update_lead_status(p_lead_id uuid, p_status text, p_is_abandoned_cart boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_caller_id UUID;
    v_now timestamp with time zone := now();
    v_rows_affected INT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Verify caller is an active admin user
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = v_caller_id AND is_active = true) THEN
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
$function$;