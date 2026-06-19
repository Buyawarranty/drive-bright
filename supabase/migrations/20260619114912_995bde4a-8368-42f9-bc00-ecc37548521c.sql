
-- 1. live_quotes: remove blanket public SELECT
DROP POLICY IF EXISTS "Public can view quotes with valid token" ON public.live_quotes;

-- 2. quote_data: remove blanket public SELECT, add secure RPC
DROP POLICY IF EXISTS "Users can view their own quote data" ON public.quote_data;

CREATE OR REPLACE FUNCTION public.restore_quote_data(_quote_id text, _email text)
RETURNS TABLE (
  quote_id text,
  vehicle_data jsonb,
  plan_data jsonb,
  customer_email text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT qd.quote_id, qd.vehicle_data, qd.plan_data, qd.customer_email, qd.expires_at
    FROM public.quote_data qd
   WHERE qd.quote_id = _quote_id
     AND lower(qd.customer_email) = lower(_email)
     AND (qd.expires_at IS NULL OR qd.expires_at > now())
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.restore_quote_data(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_quote_data(text, text) TO anon, authenticated;

-- 3. claim_update_requests: remove blanket anon SELECT, add token-scoped RPC
DROP POLICY IF EXISTS "Anyone can read requests by token" ON public.claim_update_requests;

CREATE OR REPLACE FUNCTION public.get_claim_update_request_by_token(_token text)
RETURNS TABLE (
  id uuid,
  claim_id uuid,
  token text,
  recipient_email text,
  vehicle_registration text,
  claim_reason text,
  customer_name text,
  sent_at timestamptz,
  expires_at timestamptz,
  is_responded boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.claim_id, r.token, r.recipient_email, r.vehicle_registration,
         r.claim_reason, r.customer_name, r.sent_at, r.expires_at, r.is_responded
    FROM public.claim_update_requests r
   WHERE r.token = _token
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_claim_update_request_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_claim_update_request_by_token(text) TO anon, authenticated;

-- 4. email_consents: drop the public-role "service role" policy. service_role still bypasses RLS.
DROP POLICY IF EXISTS "Service role can manage consents" ON public.email_consents;
