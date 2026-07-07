
CREATE OR REPLACE FUNCTION public.open_pool_get_next(_agent uuid)
RETURNS TABLE(lead_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing uuid;
  _picked uuid;
BEGIN
  -- One active Open Pool lock per agent
  SELECT id INTO _existing
    FROM sales_leads
   WHERE locked_by = _agent
     AND pool_status = 'calling_locked'
   ORDER BY locked_at DESC
   LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN QUERY SELECT _existing;
    RETURN;
  END IF;

  UPDATE sales_leads
     SET pool_status = 'calling_locked',
         locked_by = _agent,
         locked_at = now(),
         last_action_at = now()
   WHERE id = (
     SELECT id
       FROM sales_leads
      WHERE queue IS NOT NULL
        AND queue NOT IN ('closed', 'owned_by_agent', 'nurture_queue')
        AND (pool_status IS NULL
             OR pool_status IN ('new', 'callback_booked', 'contacted'))
        AND (owner_agent IS NULL OR owner_agent = _agent)
        AND (locked_by IS NULL OR locked_at < now() - interval '10 minutes')
        AND (next_action_at IS NULL OR next_action_at <= now())
      ORDER BY
        CASE WHEN next_action_at IS NOT NULL AND next_action_at <= now() THEN 0 ELSE 1 END,
        next_action_at NULLS LAST,
        created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
   RETURNING id INTO _picked;

  RETURN QUERY SELECT _picked;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_pool_log_outcome(
  _lead_id uuid,
  _agent uuid,
  _outcome text,
  _reason text DEFAULT NULL,
  _next_action_at timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _meaningful boolean;
BEGIN
  _meaningful := _outcome = ANY (ARRAY[
    'answered', 'callback_requested', 'quote_discussed',
    'policy_requested', 'payment_link_requested', 'objection', 'buying_intent'
  ]);

  UPDATE sales_leads
     SET call_outcome  = _outcome,
         reason        = COALESCE(_reason, reason),
         last_action_at = now(),
         next_action_at = _next_action_at,
         owner_agent   = CASE WHEN _meaningful THEN _agent ELSE owner_agent END,
         pool_status   = CASE
            WHEN _outcome = 'callback_requested' THEN 'callback_booked'
            WHEN _outcome = 'quote_discussed' THEN 'quote_sent'
            WHEN _outcome = 'policy_requested' THEN 'policy_sent'
            WHEN _outcome = 'payment_link_requested' THEN 'payment_link_sent'
            WHEN _outcome IN ('objection','buying_intent','answered') THEN 'contacted'
            WHEN _outcome = 'no_answer' THEN 'new'
            ELSE pool_status
          END,
         queue         = CASE WHEN _meaningful THEN 'owned_by_agent' ELSE queue END,
         locked_by     = CASE WHEN _meaningful THEN _agent ELSE NULL END,
         locked_at     = CASE WHEN _meaningful THEN locked_at ELSE NULL END
   WHERE id = _lead_id
     AND locked_by = _agent;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_pool_get_next(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_pool_log_outcome(uuid, uuid, text, text, timestamptz) TO authenticated;
