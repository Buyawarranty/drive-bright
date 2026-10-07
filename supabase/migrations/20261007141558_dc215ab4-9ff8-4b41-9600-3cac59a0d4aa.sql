-- Landing pages: public sees published pages only; admins see drafts too
ALTER POLICY "Admins can view all landing pages" ON public.landing_pages
  USING (status = 'published' OR public.is_admin((SELECT auth.uid())));

-- Plan documents: only documents already in effect are public; staff see all
ALTER POLICY "Anyone can view documents" ON public.customer_documents
  USING (effective_from IS NULL OR effective_from <= now() OR public.is_staff((SELECT auth.uid())));

-- Chat duty status: staff only (website chat checks availability through the server)
DROP POLICY IF EXISTS "Anyone can see who is on duty" ON public.ai_sandbox_specialist_presence;
DROP POLICY IF EXISTS "Anyone can view specialist presence" ON public.ai_sandbox_specialist_presence;
ALTER POLICY "Staff can view specialist presence" ON public.ai_sandbox_specialist_presence
  USING (public.is_staff((SELECT auth.uid())));

-- Email unsubscribes: only staff change consent rows from the browser (unsubscribe links run on the server)
ALTER POLICY "Anyone can unsubscribe" ON public.email_consents TO authenticated
  USING (public.is_staff((SELECT auth.uid())))
  WITH CHECK (public.is_staff((SELECT auth.uid())));

-- Cart tracking: visitors can only touch open, recent carts
ALTER POLICY "Allow anonymous cart tracking updates" ON public.abandoned_carts
  USING (COALESCE(is_converted, false) = false AND created_at > now() - interval '30 days')
  WITH CHECK (created_at > now() - interval '30 days');

-- Vehicle pricing rules: read through a safe function; table itself staff-only
CREATE OR REPLACE FUNCTION public.get_public_vehicle_pricing_rules()
RETURNS TABLE(id uuid, vehicle text, min_one_year numeric, treatment text, covered boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.vehicle::text, r.min_one_year::numeric, r.treatment::text, r.covered
  FROM public.pricing_vehicle_rules r ORDER BY r.sort_order;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_vehicle_pricing_rules() TO anon, authenticated;
ALTER POLICY "Anyone can read vehicle pricing rules" ON public.pricing_vehicle_rules
  USING (public.is_staff((SELECT auth.uid())));