REVOKE ALL ON FUNCTION public.get_paylater_claim_customer_ids() FROM authenticated;
CREATE OR REPLACE FUNCTION public.get_paylater_claim_customer_ids_for_staff(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
 IF NOT public.is_active_admin_user(p_user_id) OR NOT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.user_id=p_user_id AND r.role::text IN ('super_admin','admin','accounts','accounts_manager','accounts_payroll')
 ) THEN RAISE EXCEPTION 'PayLater claims access denied' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(c.id ORDER BY c.id),'[]'::jsonb) FROM public.customers c
 WHERE c.baw_paylater IS TRUE AND c.is_deleted IS NOT TRUE AND EXISTS (
 SELECT 1 FROM public.claims_submissions q WHERE q.status IS DISTINCT FROM 'fake_test' AND (
 (q.policy_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.customer_policies p WHERE p.id=q.policy_id AND p.customer_id=c.id))
 OR (q.policy_id IS NULL AND nullif(lower(btrim(c.email)),'')=nullif(lower(btrim(q.email)),'') AND (
 nullif(regexp_replace(upper(c.registration_plate),'[^A-Z0-9]','','g'),'') IS NULL
 OR nullif(regexp_replace(upper(q.vehicle_registration),'[^A-Z0-9]','','g'),'') IS NULL
 OR regexp_replace(upper(c.registration_plate),'[^A-Z0-9]','','g')=regexp_replace(upper(q.vehicle_registration),'[^A-Z0-9]','','g'))))));
END; $$;
REVOKE ALL ON FUNCTION public.get_paylater_claim_customer_ids_for_staff(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_paylater_claim_customer_ids_for_staff(uuid) TO service_role;