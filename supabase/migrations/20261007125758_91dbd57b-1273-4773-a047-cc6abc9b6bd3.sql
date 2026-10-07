-- Staff-only reads (previously any signed-in account, including customers)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('orr_config','orr_config readable by staff'),
    ('orr_release_events','release events readable by staff'),
    ('orr_exceptional_closures','closures readable by staff'),
    ('orr_agent_status_overrides','overrides readable by staff'),
    ('shark_tank_agent_caps','Everyone reads shark_tank_agent_caps'),
    ('shark_tank_pool','Agents read shark_tank_pool'),
    ('shark_tank_settings','Everyone reads shark_tank_settings'),
    ('renewal_pool_reservations','Agents read renewal_pool_reservations'),
    ('user_presence','Authenticated users can view presence'),
    ('overflow_recipients','Allow authenticated read overflow_recipients'),
    ('callrail_tracking_numbers','Authenticated can view tracking numbers'),
    ('customer_lock_events','lock events readable by staff'),
    ('renewal_offers','renewal_offers_view_authenticated'),
    ('user_badges','Anyone can view user badges'),
    ('lead_tags','All users can view lead tags')
  ) v(t,p) LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING (public.is_staff((SELECT auth.uid())))', r.p, r.t);
  END LOOP;
END $$;

-- Sync log writes: staff only (backend jobs bypass these rules anyway)
ALTER POLICY "Service can insert sync log" ON public.marketing_audience_sync_log TO authenticated WITH CHECK (public.is_staff((SELECT auth.uid())));
ALTER POLICY "Service can update sync log" ON public.marketing_audience_sync_log TO authenticated USING (public.is_staff((SELECT auth.uid()))) WITH CHECK (public.is_staff((SELECT auth.uid())));

-- Access periods: saved rows must also pass the admin check
ALTER POLICY "Admins manage access periods" ON public.admin_user_access_periods WITH CHECK (public.is_admin((SELECT auth.uid())));

-- Lead access requests: only staff can raise them
ALTER POLICY "Anyone authenticated can create access requests" ON public.lead_access_requests WITH CHECK (public.is_staff((SELECT auth.uid())));

-- Call edits: saved rows must pass the same check as who may edit
DO $$
DECLARE q text;
BEGIN
  SELECT qual INTO q FROM pg_policies WHERE schemaname='public' AND tablename='callrail_calls' AND policyname='Admins and assigned agents update calls';
  EXECUTE format('ALTER POLICY %I ON public.callrail_calls WITH CHECK (%s)', 'Admins and assigned agents update calls', q);
END $$;