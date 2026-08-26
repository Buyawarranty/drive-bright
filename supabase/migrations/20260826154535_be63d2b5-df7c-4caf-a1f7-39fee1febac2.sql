CREATE OR REPLACE FUNCTION public.list_scoreboard_unattributed_sales(p_start timestamp with time zone, p_end timestamp with time zone)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  registration_plate text,
  amount numeric,
  signup_date timestamp with time zone,
  bucket text,
  current_label text,
  current_admin_user_id uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_management(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  WITH attributed AS (
    SELECT
      c.id,
      c.name,
      c.registration_plate,
      COALESCE(c.final_amount, 0)::numeric AS amount,
      c.signup_date,
      public.resolve_sale_credit(c.sale_credit_admin_user_id, c.payment_confirmed_by, c.quote_sent_by, c.assigned_to) AS aid
    FROM public.customers c
    WHERE c.is_deleted = false
      AND LOWER(COALESCE(c.status, '')) = 'active'
      AND c.signup_date >= p_start
      AND c.signup_date <= p_end
  )
  SELECT
    a.id,
    a.name,
    a.registration_plate,
    a.amount,
    a.signup_date,
    CASE
      WHEN a.aid IS NULL OR au.id IS NULL THEN 'unattributed'
      WHEN au.role NOT IN ('sales', 'sales_lead') THEN 'management'
      WHEN tm.admin_user_id IS NULL THEN 'no_team'
      ELSE 'agent'
    END AS bucket,
    CASE
      WHEN a.aid IS NULL OR au.id IS NULL THEN 'No agent on the record'
      ELSE COALESCE(NULLIF(TRIM(COALESCE(au.first_name, '') || ' ' || COALESCE(au.last_name, '')), ''), au.email)
    END AS current_label,
    au.id
  FROM attributed a
  LEFT JOIN public.admin_users au ON au.id = a.aid AND au.is_active
  LEFT JOIN public.lead_team_members tm ON tm.admin_user_id = au.id
  WHERE (a.aid IS NULL OR au.id IS NULL OR au.role NOT IN ('sales', 'sales_lead') OR tm.admin_user_id IS NULL)
  ORDER BY a.amount DESC, a.signup_date DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_scoreboard_unattributed_sales(timestamp with time zone, timestamp with time zone) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_sale_credit_agent(p_customer_id uuid, p_admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_management(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF p_admin_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.id = p_admin_user_id AND au.is_active AND au.role IN ('sales', 'sales_lead')
  ) THEN
    RAISE EXCEPTION 'Sale credit must be an active sales agent';
  END IF;

  UPDATE public.customers
  SET sale_credit_admin_user_id = p_admin_user_id,
      updated_at = now()
  WHERE id = p_customer_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_sale_credit_agent(uuid, uuid) TO authenticated, service_role;