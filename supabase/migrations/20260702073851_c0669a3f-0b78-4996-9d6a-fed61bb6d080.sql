
-- ============================================================
-- 1. abandoned_carts: remove broad anon SELECT, add safe RPC
-- ============================================================
DROP POLICY IF EXISTS "Allow anonymous cart lookup by vehicle reg" ON public.abandoned_carts;

CREATE OR REPLACE FUNCTION public.find_open_cart_id_by_reg(_vehicle_reg text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.abandoned_carts
  WHERE vehicle_reg = _vehicle_reg
    AND is_converted = false
  ORDER BY created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_open_cart_id_by_reg(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_open_cart_id_by_reg(text) TO anon, authenticated;

-- ============================================================
-- 2. welcome_emails: remove customer-facing SELECT of plaintext password
-- ============================================================
DROP POLICY IF EXISTS "Customers can view own welcome email" ON public.welcome_emails;

-- ============================================================
-- 3. Fix "Service role can manage ..." policies incorrectly applied to public
--    Change TO public -> TO service_role for each affected table
-- ============================================================
ALTER POLICY "Service role can manage brevo sync logs" ON public.brevo_sync_log TO service_role;
ALTER POLICY "Service role can manage analytics" ON public.campaign_analytics TO service_role;
ALTER POLICY "Service role can manage claim communications" ON public.claim_communications TO service_role;
ALTER POLICY "Service role can manage claim tags" ON public.claim_tags TO service_role;
ALTER POLICY "Service role can manage claims submissions" ON public.claims_submissions TO service_role;
ALTER POLICY "Service role can manage contact submissions" ON public.contact_submissions TO service_role;
ALTER POLICY "Service role can manage documents" ON public.customer_documents TO service_role;
ALTER POLICY "Service role can manage notifications" ON public.customer_notifications TO service_role;
ALTER POLICY "Service role can manage all policies" ON public.customer_policies TO service_role;
ALTER POLICY "Service role can manage tag assignments" ON public.customer_tag_assignments TO service_role;
ALTER POLICY "Service role can manage customer tags" ON public.customer_tags TO service_role;
ALTER POLICY "Service role can manage usage" ON public.discount_code_usage TO service_role;
ALTER POLICY "Service role can manage discount codes" ON public.discount_codes TO service_role;
ALTER POLICY "Service role can manage campaigns" ON public.email_campaigns TO service_role;
ALTER POLICY "Service role can manage email logs" ON public.email_logs TO service_role;
ALTER POLICY "Service role can access email templates" ON public.email_templates TO service_role;
ALTER POLICY "service role only - select" ON public.ghl_push_queue TO service_role;
ALTER POLICY "Service role can manage activities" ON public.lead_activities TO service_role;
ALTER POLICY "Service role can manage tag assignments" ON public.lead_tag_assignments TO service_role;
ALTER POLICY "Service role can manage MOT history" ON public.mot_history TO service_role;
ALTER POLICY "Service role can manage newsletter signups" ON public.newsletter_signups TO service_role;
ALTER POLICY "Service role can read plan document mapping" ON public.plan_document_mapping TO service_role;
ALTER POLICY "Service role can manage round robin state" ON public.round_robin_state TO service_role;
ALTER POLICY "Service role can manage leads" ON public.sales_leads TO service_role;
ALTER POLICY "Service role can manage sales targets" ON public.sales_targets TO service_role;
ALTER POLICY "Service role can manage stats" ON public.salesperson_stats TO service_role;
ALTER POLICY "Service role can manage scheduled emails" ON public.scheduled_emails TO service_role;
ALTER POLICY "Service role can manage structured notes" ON public.structured_customer_notes TO service_role;
ALTER POLICY "Service role can manage trustpilot review emails" ON public.trustpilot_review_emails TO service_role;
ALTER POLICY "Service role can manage user badges" ON public.user_badges TO service_role;
ALTER POLICY "Service role can manage daily online time" ON public.user_daily_online_time TO service_role;
ALTER POLICY "Service role can insert warranty audit logs" ON public.warranty_audit_log TO service_role;
