CREATE OR REPLACE FUNCTION public.check_login_lockout(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_fifth timestamptz;
BEGIN
  -- Count failed attempts in the last 15 minutes, ignoring any that
  -- happened before the most recent successful sign-in (a success resets
  -- the lockout count).
  SELECT count(*) INTO v_count
  FROM public.customer_login_attempts
  WHERE lower(email) = lower(trim(p_email))
    AND event_type = 'login_failed'
    AND created_at > now() - interval '15 minutes'
    AND created_at > COALESCE((
      SELECT max(created_at)
      FROM public.customer_login_attempts
      WHERE lower(email) = lower(trim(p_email))
        AND event_type = 'login_success'
    ), '-infinity'::timestamptz);

  IF v_count < 5 THEN
    RETURN jsonb_build_object('locked', false, 'failed_count', v_count, 'retry_after_seconds', 0);
  END IF;

  -- Lock expires 15 minutes after the 5th-most-recent failure ages out.
  SELECT created_at INTO v_fifth
  FROM public.customer_login_attempts
  WHERE lower(email) = lower(trim(p_email))
    AND event_type = 'login_failed'
    AND created_at > now() - interval '15 minutes'
  ORDER BY created_at DESC
  OFFSET 4 LIMIT 1;

  RETURN jsonb_build_object(
    'locked', true,
    'failed_count', v_count,
    'retry_after_seconds', GREATEST(1, EXTRACT(EPOCH FROM ((COALESCE(v_fifth, now()) + interval '15 minutes') - now())))::int
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_login_lockout(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_login_lockout(text) TO authenticated;