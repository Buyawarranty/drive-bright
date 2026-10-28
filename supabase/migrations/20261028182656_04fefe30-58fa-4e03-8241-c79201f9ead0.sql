CREATE OR REPLACE FUNCTION private_lead_access.can_access_checkout_alert(_email text, _phone text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_staff public.admin_users%ROWTYPE; v_lead public.sales_leads%ROWTYPE; v_phone9 text;
BEGIN
 SELECT * INTO v_staff FROM public.admin_users WHERE user_id=auth.uid() AND is_active=true AND archived_at IS NULL LIMIT 1;
 IF NOT FOUND THEN RETURN false; END IF;
 IF v_staff.role::text IN ('admin','super_admin') THEN RETURN true; END IF;
 IF v_staff.role::text NOT IN ('sales','sales_lead') THEN RETURN false; END IF;
 v_phone9 := right(regexp_replace(coalesce(_phone,''),'[^0-9]','','g'),9);
 SELECT sl.* INTO v_lead FROM public.sales_leads sl
 WHERE (nullif(btrim(_email),'') IS NOT NULL AND lower(btrim(sl.email))=lower(btrim(_email)))
 OR (length(v_phone9)=9 AND right(public.normalize_uk_phone(sl.phone),9)=v_phone9)
 ORDER BY sl.created_at DESC,sl.id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN false; END IF;
 RETURN coalesce(v_lead.assigned_to = v_staff.id AND NOT coalesce(v_lead.management_hold,false),false);
END;
$$;