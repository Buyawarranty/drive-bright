CREATE OR REPLACE FUNCTION public.get_scoreboard_reconciliation(p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS TABLE(bucket text, label text, revenue numeric, sales_count integer)
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
      public.resolve_sale_credit(c.sale_credit_admin_user_id, c.payment_confirmed_by, c.quote_sent_by, c.assigned_to) AS aid,
      COALESCE(c.final_amount, 0)::numeric AS amount
    FROM public.customers c
    WHERE c.is_deleted = false
      AND LOWER(COALESCE(c.status, '')) = 'active'
      AND c.signup_date >= p_start
      AND c.signup_date <= p_end
    UNION ALL
    SELECT cc.agent_id, COALESCE(cc.deal_value, 0)::numeric
    FROM public.commission_claims cc
    WHERE cc.status = 'approved'
      AND cc.created_at >= p_start
      AND cc.created_at <= p_end
      AND cc.agent_id IS NOT NULL
  ),
  classified AS (
    SELECT
      CASE
        WHEN a.aid IS NULL OR au.id IS NULL THEN 'unattributed'
        WHEN au.role NOT IN ('sales', 'sales_lead') THEN 'management'
        WHEN tm.admin_user_id IS NULL THEN 'no_team'
        ELSE 'agent'
      END AS bucket,
      CASE
        WHEN a.aid IS NULL OR au.id IS NULL THEN 'No agent on the record'
        ELSE COALESCE(NULLIF(TRIM(COALESCE(au.first_name, '') || ' ' || COALESCE(au.last_name, '')), ''), au.email)
      END AS label,
      a.amount
    FROM attributed a
    LEFT JOIN public.admin_users au ON au.id = a.aid AND au.is_active
    LEFT JOIN public.lead_team_members tm ON tm.admin_user_id = au.id
  )
  SELECT c.bucket, c.label, SUM(c.amount)::numeric, COUNT(*)::int
  FROM classified c
  GROUP BY c.bucket, c.label
  ORDER BY 3 DESC;
END;
$function$;