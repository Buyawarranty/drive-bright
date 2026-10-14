DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.get_team_scoreboard(timestamptz,timestamptz)'::regprocedure);
  d := replace(d,
$a$        CASE
          WHEN REPLACE(LOWER(COALESCE(c.purchase_source, '')), '_', '') LIKE '%paybetter%'$a$,
$b$        CASE
          WHEN EXISTS (SELECT 1 FROM public.baw_paylater_schedules bp WHERE bp.customer_id = c.id)
            THEN COALESCE((SELECT bp1.amount FROM public.baw_paylater_schedules bp1
                           WHERE bp1.customer_id = c.id ORDER BY bp1.year_number ASC LIMIT 1), 0)::numeric
          WHEN REPLACE(LOWER(COALESCE(c.purchase_source, '')), '_', '') LIKE '%paybetter%'$b$);
  IF position('baw_paylater_schedules' in d) = 0 THEN RAISE EXCEPTION 'patch failed'; END IF;
  EXECUTE d;
END $mig$;