CREATE OR REPLACE FUNCTION public.can_access_assigned_sales_lead(_assigned_to uuid, _management_hold boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid() AND au.is_active = true AND au.archived_at IS NULL AND (au.role::text NOT IN ('sales','sales_lead') OR (au.id = _assigned_to AND NOT coalesce(_management_hold,false))));
$$;
REVOKE ALL ON FUNCTION public.can_access_assigned_sales_lead(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_assigned_sales_lead(uuid,boolean) TO authenticated,service_role;

CREATE POLICY "Current ownership limits lead reads" ON public.sales_leads AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_access_assigned_sales_lead(assigned_to,management_hold));
CREATE POLICY "Current ownership limits lead updates" ON public.sales_leads AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.can_access_assigned_sales_lead(assigned_to,management_hold)) WITH CHECK (public.can_access_assigned_sales_lead(assigned_to,management_hold));
CREATE POLICY "Current ownership limits lead deletion" ON public.sales_leads AS RESTRICTIVE FOR DELETE TO authenticated USING (public.can_access_assigned_sales_lead(assigned_to,management_hold));

CREATE OR REPLACE FUNCTION public.can_access_checkout_alert(_email text, _phone text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_staff public.admin_users%ROWTYPE; v_lead public.sales_leads%ROWTYPE; v_phone9 text;
BEGIN
 SELECT * INTO v_staff FROM public.admin_users WHERE user_id=auth.uid() AND is_active=true AND archived_at IS NULL LIMIT 1;
 IF NOT FOUND THEN RETURN false; END IF;
 IF v_staff.role::text NOT IN ('sales','sales_lead') THEN RETURN true; END IF;
 v_phone9 := right(regexp_replace(coalesce(_phone,''),'[^0-9]','','g'),9);
 SELECT sl.* INTO v_lead FROM public.sales_leads sl
 WHERE (nullif(btrim(_email),'') IS NOT NULL AND lower(btrim(sl.email))=lower(btrim(_email)))
 OR (length(v_phone9)=9 AND right(public.normalize_uk_phone(sl.phone),9)=v_phone9)
 ORDER BY sl.created_at DESC,sl.id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN false; END IF;
 RETURN v_lead.assigned_to = v_staff.id AND NOT coalesce(v_lead.management_hold,false);
END;
$$;
REVOKE ALL ON FUNCTION public.can_access_checkout_alert(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_checkout_alert(text,text) TO authenticated,service_role;
CREATE POLICY "Current ownership limits checkout alert reads" ON public.checkout_struggle_alerts AS RESTRICTIVE FOR SELECT TO authenticated USING (public.can_access_checkout_alert(customer_email,customer_phone));
CREATE POLICY "Current ownership limits checkout alert updates" ON public.checkout_struggle_alerts AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.can_access_checkout_alert(customer_email,customer_phone)) WITH CHECK (public.can_access_checkout_alert(customer_email,customer_phone));

ALTER FUNCTION public.find_lead_owner_by_contact(text,text) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.find_lead_owner_by_contact(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.find_lead_owner_by_contact(text,text) TO authenticated,service_role;