
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
  _new_status  text;
  _new_queue   text;
  _new_owner   uuid;
  _keep_lock   boolean := false;
  _tags        text[]  := ARRAY[]::text[];
  _inc_calls   integer := 0;
  _current_calls integer;
  _no_answer_tag text;
BEGIN
  -- Verify agent owns the lock
  PERFORM 1 FROM sales_leads WHERE id = _lead_id AND locked_by = _agent;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead is not locked to this agent';
  END IF;

  -- Required-field validation
  IF _outcome = 'callback_requested' AND _next_action_at IS NULL THEN
    RAISE EXCEPTION 'Callback date/time is required';
  END IF;
  IF _outcome = 'not_interested' AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'Lost reason is required';
  END IF;

  SELECT COALESCE(call_count, 0) INTO _current_calls FROM sales_leads WHERE id = _lead_id;

  -- Map outcome → status/queue/owner/tags/side-effects
  CASE _outcome
    WHEN 'spoke_to_customer' THEN
      _new_status := 'contacted';       _new_queue := 'owned_by_agent'; _new_owner := _agent; _keep_lock := true;
    WHEN 'no_answer' THEN
      _new_status := 'new';             _new_queue := 'retry_queue';    _new_owner := NULL;
      _inc_calls := 1;
      _no_answer_tag := 'no_answer_' || LEAST(_current_calls + 1, 3)::text;
      _tags := ARRAY[_no_answer_tag];
    WHEN 'voicemail_left' THEN
      _new_status := 'new';             _new_queue := 'retry_queue';    _new_owner := NULL;
      _inc_calls := 1;
      _tags := ARRAY['voicemail_left'];
    WHEN 'callback_requested' THEN
      _new_status := 'callback_booked'; _new_queue := 'callback_queue'; _new_owner := _agent; _keep_lock := true;
    WHEN 'quote_sent' THEN
      _new_status := 'quote_sent';      _new_queue := 'owned_by_agent'; _new_owner := _agent; _keep_lock := true;
      _tags := ARRAY['quote_sent'];
    WHEN 'policy_sent' THEN
      _new_status := 'policy_sent';     _new_queue := 'owned_by_agent'; _new_owner := _agent; _keep_lock := true;
      _tags := ARRAY['policy_booklet_sent'];
    WHEN 'payment_link_sent' THEN
      _new_status := 'payment_link_sent'; _new_queue := 'owned_by_agent'; _new_owner := _agent; _keep_lock := true;
      _tags := ARRAY['payment_link_sent'];
    WHEN 'sold' THEN
      _new_status := 'converted';       _new_queue := 'closed';         _new_owner := _agent; _keep_lock := true;
    WHEN 'wrong_number' THEN
      _new_status := 'invalid';         _new_queue := 'closed';         _new_owner := NULL;
    WHEN 'not_interested' THEN
      _new_status := 'lost';            _new_queue := 'closed';         _new_owner := NULL;
    ELSE
      RAISE EXCEPTION 'Unknown call outcome: %', _outcome;
  END CASE;

  UPDATE sales_leads
     SET call_outcome   = _outcome,
         pool_status    = _new_status,
         queue          = _new_queue,
         owner_agent    = COALESCE(_new_owner, owner_agent) ,
         reason         = CASE
                            WHEN _outcome = 'wrong_number' THEN 'Invalid details'
                            WHEN _reason IS NOT NULL THEN _reason
                            ELSE reason
                          END,
         lost_reason    = CASE WHEN _outcome = 'not_interested' THEN _reason ELSE lost_reason END,
         next_action_at = CASE WHEN _outcome = 'callback_requested' THEN _next_action_at ELSE NULL END,
         last_action_at = now(),
         call_count     = COALESCE(call_count, 0) + _inc_calls,
         auto_tags      = (
           SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags, ARRAY[]::text[]) || _tags))
         ),
         payment_method = CASE WHEN _outcome = 'payment_link_sent' THEN 'link_sent' ELSE payment_method END,
         is_paid        = CASE WHEN _outcome = 'sold' THEN true ELSE is_paid END,
         payment_date   = CASE WHEN _outcome = 'sold' THEN now() ELSE payment_date END,
         locked_by      = CASE WHEN _keep_lock THEN _agent ELSE NULL END,
         locked_at      = CASE WHEN _keep_lock THEN locked_at ELSE NULL END,
         -- If not keeping lock but new owner is set, clear owner too (retry/lost/wrong)
         owner_agent    = CASE
                            WHEN _new_owner IS NULL AND NOT _keep_lock THEN NULL
                            ELSE COALESCE(_new_owner, owner_agent)
                          END
   WHERE id = _lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_pool_log_outcome(uuid, uuid, text, text, timestamptz) TO authenticated;
