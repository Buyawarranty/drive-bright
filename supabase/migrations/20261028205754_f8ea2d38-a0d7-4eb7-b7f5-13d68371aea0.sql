-- The wake function is only ever run by the trigger, never called by a
-- person, so remove the default "anyone can execute" grant and state the
-- closed marker explicitly.
REVOKE EXECUTE ON FUNCTION public.wake_lead_opening_rate_check() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wake_lead_opening_rate_check() TO service_role;

-- lead_opening_rate_wakes is server bookkeeping: an explicit deny policy for
-- signed-in staff, while the server-side check keeps working.
CREATE POLICY "Nobody reads the opening rate marker" ON public.lead_opening_rate_wakes FOR ALL TO authenticated
USING (false) WITH CHECK (false);
