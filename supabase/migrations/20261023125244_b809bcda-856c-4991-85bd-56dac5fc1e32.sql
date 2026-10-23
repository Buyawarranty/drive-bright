-- Allow 'Expired' as a customer status
ALTER TABLE public.customers DROP CONSTRAINT customers_status_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_status_check CHECK (status = ANY (ARRAY['Active'::text, 'Cancelled'::text, 'Expired'::text]));

CREATE OR REPLACE FUNCTION public.expire_overdue_policies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- 1. Mark policies past their end date as expired (never touch cancelled/refunded/voided)
  WITH updated AS (
    UPDATE public.customer_policies
    SET status = 'expired', updated_at = now()
    WHERE policy_end_date IS NOT NULL
      AND policy_end_date < now()
      AND COALESCE(is_deleted, false) = false
      AND lower(COALESCE(status, '')) IN ('active', 'scheduled', '')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  -- 2. Mark the customer as Expired only when they have an expired policy
  --    and no remaining live (active/scheduled, not yet ended) policy
  UPDATE public.customers c
  SET status = 'Expired', updated_at = now()
  WHERE lower(COALESCE(c.status, '')) = 'active'
    AND COALESCE(c.is_deleted, false) = false
    AND EXISTS (
      SELECT 1 FROM public.customer_policies cp
      WHERE cp.customer_id = c.id
        AND COALESCE(cp.is_deleted, false) = false
        AND lower(COALESCE(cp.status, '')) = 'expired'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.customer_policies cp
      WHERE cp.customer_id = c.id
        AND COALESCE(cp.is_deleted, false) = false
        AND lower(COALESCE(cp.status, '')) IN ('active', 'scheduled')
        AND (cp.policy_end_date IS NULL OR cp.policy_end_date >= now())
    );

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.expire_overdue_policies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_overdue_policies() TO service_role;

-- Nightly job so warranties expire on their end date
DO $d$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-overdue-policies-daily') THEN
    PERFORM cron.unschedule('expire-overdue-policies-daily');
  END IF;
END
$d$;

SELECT cron.schedule('expire-overdue-policies-daily', '10 0 * * *', $c$SELECT public.expire_overdue_policies();$c$);

-- Immediate backfill for policies already past their end date
SELECT public.expire_overdue_policies();