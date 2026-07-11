
ALTER TABLE public.shark_tank_settings
  ADD COLUMN IF NOT EXISTS renewal_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_window_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS renewal_stale_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS renewal_owner_inactive_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS renewal_hold_seconds integer NOT NULL DEFAULT 120;

CREATE TABLE IF NOT EXISTS public.renewal_pool_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL UNIQUE REFERENCES public.customer_policies(id) ON DELETE CASCADE,
  locked_by uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  locked_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  owned_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  owned_at timestamptz,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','owned','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.renewal_pool_reservations TO authenticated;
GRANT ALL ON public.renewal_pool_reservations TO service_role;

ALTER TABLE public.renewal_pool_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents read renewal_pool_reservations" ON public.renewal_pool_reservations;
CREATE POLICY "Agents read renewal_pool_reservations"
  ON public.renewal_pool_reservations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Management writes renewal_pool_reservations" ON public.renewal_pool_reservations;
CREATE POLICY "Management writes renewal_pool_reservations"
  ON public.renewal_pool_reservations FOR ALL TO authenticated
  USING (public.shark_tank_is_management())
  WITH CHECK (public.shark_tank_is_management());

CREATE INDEX IF NOT EXISTS idx_renewal_pool_reservations_status
  ON public.renewal_pool_reservations(status, locked_at);

DROP TRIGGER IF EXISTS trg_renewal_pool_reservations_touch ON public.renewal_pool_reservations;
CREATE TRIGGER trg_renewal_pool_reservations_touch
  BEFORE UPDATE ON public.renewal_pool_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.renewal_pool_get_next(_agent uuid)
RETURNS TABLE(policy_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shark_tank_settings%ROWTYPE;
  existing uuid;
  picked uuid;
BEGIN
  SELECT * INTO s FROM public.shark_tank_settings WHERE id = 1;
  IF NOT COALESCE(s.renewal_enabled, false) THEN
    RETURN;
  END IF;

  SELECT r.policy_id INTO existing
    FROM public.renewal_pool_reservations r
   WHERE r.locked_by = _agent
     AND r.status = 'reserved'
     AND r.locked_at > now() - make_interval(secs => s.renewal_hold_seconds)
   ORDER BY r.locked_at DESC
   LIMIT 1;
  IF existing IS NOT NULL THEN
    RETURN QUERY SELECT existing;
    RETURN;
  END IF;

  WITH candidate AS (
    SELECT cp.id
      FROM public.customer_policies cp
      LEFT JOIN public.customers c   ON c.id = cp.customer_id
      LEFT JOIN public.renewal_pool_reservations r ON r.policy_id = cp.id
      LEFT JOIN public.admin_users au ON au.user_id = c.assigned_to
     WHERE cp.status NOT IN ('cancelled','refunded','expired','voided','deleted')
       AND (cp.is_deleted IS NULL OR cp.is_deleted = false)
       AND cp.policy_end_date IS NOT NULL
       AND cp.policy_end_date >= now()
       AND cp.policy_end_date <= now() + make_interval(days => s.renewal_window_days)
       AND COALESCE(cp.retention_outcome,'') NOT IN ('renewed','upgraded','renewed_upgraded','declined','do_not_contact')
       AND (
            c.assigned_to IS NULL
         OR au.is_active = false
         OR (cp.retention_worked_at IS NULL
              OR cp.retention_worked_at < now() - make_interval(days => s.renewal_stale_days))
       )
       AND (
            r.id IS NULL
         OR r.status <> 'reserved'
         OR r.locked_at < now() - make_interval(secs => s.renewal_hold_seconds)
       )
     ORDER BY cp.policy_end_date ASC
     LIMIT 1
     FOR UPDATE OF cp SKIP LOCKED
  )
  INSERT INTO public.renewal_pool_reservations (policy_id, locked_by, locked_at, status)
  SELECT id, _agent, now(), 'reserved' FROM candidate
  ON CONFLICT (policy_id) DO UPDATE
     SET locked_by = EXCLUDED.locked_by,
         locked_at = EXCLUDED.locked_at,
         status = 'reserved',
         released_at = NULL
  RETURNING renewal_pool_reservations.policy_id INTO picked;

  RETURN QUERY SELECT picked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.renewal_pool_get_next(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.renewal_pool_release_expired()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.shark_tank_settings%ROWTYPE;
  n integer := 0;
BEGIN
  SELECT * INTO s FROM public.shark_tank_settings WHERE id = 1;
  WITH freed AS (
    UPDATE public.renewal_pool_reservations
       SET status = 'released', released_at = now()
     WHERE status = 'reserved'
       AND locked_at < now() - make_interval(secs => COALESCE(s.renewal_hold_seconds, 120))
     RETURNING 1
  ) SELECT count(*) INTO n FROM freed;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.renewal_pool_release_expired() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.renewal_pool_stamp_ownership(_policy uuid, _agent uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  UPDATE public.renewal_pool_reservations
     SET status = 'owned', owned_by = _agent, owned_at = now()
   WHERE policy_id = _policy AND status = 'reserved';

  SELECT user_id INTO _uid FROM public.admin_users WHERE id = _agent;
  IF _uid IS NOT NULL THEN
    UPDATE public.customers c
       SET assigned_to = _uid
      FROM public.customer_policies cp
     WHERE cp.id = _policy
       AND cp.customer_id = c.id
       AND c.assigned_to IS NULL;
  END IF;

  UPDATE public.customer_policies
     SET retention_worked_at = now()
   WHERE id = _policy;
END;
$$;

GRANT EXECUTE ON FUNCTION public.renewal_pool_stamp_ownership(uuid, uuid) TO authenticated;

DO $$
DECLARE _jid bigint;
BEGIN
  FOR _jid IN SELECT jobid FROM cron.job WHERE jobname = 'renewal-pool-release-expired'
  LOOP PERFORM cron.unschedule(_jid); END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'renewal-pool-release-expired',
  '* * * * *',
  $$SELECT public.renewal_pool_release_expired();$$
);
