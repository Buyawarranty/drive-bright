
CREATE OR REPLACE FUNCTION public.assign_lead_to_agent(
    p_lead_id UUID,
    p_agent_id UUID,
    p_is_abandoned_cart BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_admin RECORD;
    v_now timestamp with time zone := now();
    v_rows_affected INT;
    v_old_agent UUID;
BEGIN
    -- Verify the caller is authenticated
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Verify the caller is an active admin user
    SELECT id, role INTO v_caller_admin
    FROM admin_users
    WHERE user_id = v_caller_id AND is_active = true;

    IF v_caller_admin IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;

    -- If agent_id is provided, verify the target agent exists
    IF p_agent_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM admin_users WHERE id = p_agent_id AND is_active = true) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Target agent not found or inactive');
        END IF;
    END IF;

    IF p_is_abandoned_cart THEN
        DECLARE
            v_auth_user_id UUID;
        BEGIN
            IF p_agent_id IS NOT NULL THEN
                SELECT user_id INTO v_auth_user_id FROM admin_users WHERE id = p_agent_id;
            END IF;

            UPDATE abandoned_carts
            SET contacted_by = v_auth_user_id,
                last_contacted_at = CASE WHEN v_auth_user_id IS NOT NULL THEN v_now ELSE NULL END,
                updated_at = v_now
            WHERE id = p_lead_id;

            GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        END;
    ELSE
        -- Capture old agent before update (for decrementing their counter)
        SELECT assigned_to INTO v_old_agent FROM sales_leads WHERE id = p_lead_id;

        UPDATE sales_leads
        SET assigned_to = p_agent_id,
            assigned_at = CASE WHEN p_agent_id IS NOT NULL THEN v_now ELSE NULL END,
            updated_at = v_now
        WHERE id = p_lead_id;

        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

        -- Update distribution counters to keep round-robin in sync
        IF v_rows_affected > 0 THEN
            -- Increment new agent's counter
            IF p_agent_id IS NOT NULL THEN
                UPDATE agent_distribution_caps
                SET assigned_today = COALESCE(assigned_today, 0) + 1,
                    last_assigned_at = v_now
                WHERE admin_user_id = p_agent_id;
            END IF;

            -- Decrement old agent's counter (if reassigning away)
            IF v_old_agent IS NOT NULL AND v_old_agent IS DISTINCT FROM p_agent_id THEN
                UPDATE agent_distribution_caps
                SET assigned_today = GREATEST(COALESCE(assigned_today, 0) - 1, 0)
                WHERE admin_user_id = v_old_agent;
            END IF;
        END IF;
    END IF;

    IF v_rows_affected = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
    END IF;

    RETURN jsonb_build_object('success', true, 'rows_affected', v_rows_affected);
END;
$$;
