DO $$
DECLARE
  r record;
  q text;
  w text;
  stmt text;
  n int := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ( qual ~ '(^|[^_a-zA-Z0-9.(])auth\.(uid|jwt|role)\(\)'
         OR with_check ~ '(^|[^_a-zA-Z0-9.(])auth\.(uid|jwt|role)\(\)' )
  LOOP
    q := r.qual;
    w := r.with_check;

    IF q IS NOT NULL THEN
      q := regexp_replace(q, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
      q := regexp_replace(q, 'auth\.jwt\(\)', '(SELECT auth.jwt())', 'g');
      q := regexp_replace(q, 'auth\.role\(\)', '(SELECT auth.role())', 'g');
      q := replace(q, '( SELECT (SELECT auth.uid())', '( SELECT auth.uid()');
      q := replace(q, '( SELECT (SELECT auth.jwt())', '( SELECT auth.jwt()');
      q := replace(q, '( SELECT (SELECT auth.role())', '( SELECT auth.role()');
    END IF;

    IF w IS NOT NULL THEN
      w := regexp_replace(w, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
      w := regexp_replace(w, 'auth\.jwt\(\)', '(SELECT auth.jwt())', 'g');
      w := regexp_replace(w, 'auth\.role\(\)', '(SELECT auth.role())', 'g');
      w := replace(w, '( SELECT (SELECT auth.uid())', '( SELECT auth.uid()');
      w := replace(w, '( SELECT (SELECT auth.jwt())', '( SELECT auth.jwt()');
      w := replace(w, '( SELECT (SELECT auth.role())', '( SELECT auth.role()');
    END IF;

    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF q IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', q);
    END IF;
    IF w IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', w);
    END IF;

    EXECUTE stmt;
    n := n + 1;
  END LOOP;

  RAISE NOTICE 'Rewrote % policies', n;
END $$;