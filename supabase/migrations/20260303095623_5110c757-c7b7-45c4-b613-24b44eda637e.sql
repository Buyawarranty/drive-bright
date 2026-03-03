
-- CRITICAL FIX: Grant INSERT permission on sales_leads to anon and authenticated roles
-- Without this, the RLS INSERT policies are completely ineffective
-- This is why ALL leads from today (10+) failed to save despite the form completing

GRANT INSERT ON public.sales_leads TO anon;
GRANT INSERT ON public.sales_leads TO authenticated;

-- Also grant SELECT on sales_leads for authenticated (needed for dashboard queries)
GRANT SELECT ON public.sales_leads TO authenticated;

-- Grant usage on sequences if any (needed for default values)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Also ensure the scheduled_sms table has proper grants (it works currently, but let's be safe)
GRANT INSERT ON public.scheduled_sms TO anon;
GRANT INSERT ON public.scheduled_sms TO authenticated;
