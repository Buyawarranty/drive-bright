DO $$
DECLARE r record; q text; w text; stmt text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname='public'
      AND ( regexp_replace(coalesce(qual,''),'\( SELECT auth\.(uid|jwt|role)\(\)( AS [a-z]+)?\)','X','g') ~ 'auth\.(uid|jwt|role)\(\)'
         OR regexp_replace(coalesce(with_check,''),'\( SELECT auth\.(uid|jwt|role)\(\)( AS [a-z]+)?\)','X','g') ~ 'auth\.(uid|jwt|role)\(\)' )
  LOOP
    q := r.qual; w := r.with_check;
    IF q IS NOT NULL THEN
      q := replace(replace(replace(q,'auth.uid()','( SELECT auth.uid() )'),'auth.jwt()','( SELECT auth.jwt() )'),'auth.role()','( SELECT auth.role() )');
      q := replace(replace(replace(q,'( SELECT ( SELECT auth.uid() )','( SELECT auth.uid()'),'( SELECT ( SELECT auth.jwt() )','( SELECT auth.jwt()'),'( SELECT ( SELECT auth.role() )','( SELECT auth.role()');
    END IF;
    IF w IS NOT NULL THEN
      w := replace(replace(replace(w,'auth.uid()','( SELECT auth.uid() )'),'auth.jwt()','( SELECT auth.jwt() )'),'auth.role()','( SELECT auth.role() )');
      w := replace(replace(replace(w,'( SELECT ( SELECT auth.uid() )','( SELECT auth.uid()'),'( SELECT ( SELECT auth.jwt() )','( SELECT auth.jwt()'),'( SELECT ( SELECT auth.role() )','( SELECT auth.role()');
    END IF;
    stmt := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF q IS NOT NULL THEN stmt := stmt || format(' USING (%s)', q); END IF;
    IF w IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', w); END IF;
    EXECUTE stmt;
  END LOOP;
END $$;