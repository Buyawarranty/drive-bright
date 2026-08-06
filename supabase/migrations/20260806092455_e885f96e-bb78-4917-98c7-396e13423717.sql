ALTER TABLE public.concession_allowances
  ADD COLUMN IF NOT EXISTS allow_1mo integer NOT NULL DEFAULT 20;

DROP FUNCTION IF EXISTS public.get_concession_usage(uuid, text);

CREATE FUNCTION public.get_concession_usage(p_admin_user_id uuid, p_year_month text)
 RETURNS TABLE(used_3mo bigint, used_6mo bigint, used_1mo bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH bounds AS (
    SELECT
      (p_year_month || '-01')::date AT TIME ZONE 'Europe/London' AS month_start,
      ((p_year_month || '-01')::date + INTERVAL '1 month') AT TIME ZONE 'Europe/London' AS month_end
  )
  SELECT
    COALESCE(count(*) FILTER (WHERE c.seasonal_bonus_months = 3), 0)::bigint AS used_3mo,
    COALESCE(count(*) FILTER (WHERE c.seasonal_bonus_months = 6), 0)::bigint AS used_6mo,
    COALESCE(count(*) FILTER (WHERE c.seasonal_bonus_months IN (1, 2)), 0)::bigint AS used_1mo
  FROM public.customers c
  CROSS JOIN bounds b
  WHERE c.assigned_to = p_admin_user_id
    AND c.signup_date >= b.month_start
    AND c.signup_date < b.month_end
    AND c.seasonal_bonus_months IN (1, 2, 3, 6)
    AND c.status NOT IN ('Cancelled', 'Refunded');
$function$;