ALTER TABLE public.lead_team_members ADD COLUMN show_own_attendance_bar boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.lead_team_members.show_own_attendance_bar IS 'Management-controlled display of this agent own New Leads progress/attendance bar; defaults off, does not affect attendance recording.';
CREATE FUNCTION public.guard_own_attendance_bar_setting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (TG_OP = 'INSERT' AND NEW.show_own_attendance_bar) OR (TG_OP = 'UPDATE' AND NEW.show_own_attendance_bar IS DISTINCT FROM OLD.show_own_attendance_bar) THEN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_management((SELECT auth.uid())) THEN
   RAISE EXCEPTION 'Only management can change attendance bar visibility' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_own_attendance_bar_setting BEFORE INSERT OR UPDATE ON public.lead_team_members FOR EACH ROW EXECUTE FUNCTION public.guard_own_attendance_bar_setting();
REVOKE ALL ON FUNCTION public.guard_own_attendance_bar_setting() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.search_import_leads(text,integer) RENAME TO search_import_leads_unrestricted;
REVOKE ALL ON FUNCTION public.search_import_leads_unrestricted(text,integer) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.search_import_leads(p_term text, p_limit integer DEFAULT 25)
RETURNS TABLE(source text,row_id text,first_name text,last_name text,email text,phone text,vehicle_reg text,vehicle_make text,vehicle_model text,vehicle_year text,mileage text,plan_interest text,assigned_to uuid,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_admin_id uuid;
 v_role text;
 v_raw text := btrim(coalesce(p_term,''));
 v_compact text;
 v_spaced text;
 v_digits text;
 v_tail9 text;
 v_frag text;
BEGIN
 IF NOT public.is_active_admin_user((SELECT auth.uid())) THEN RETURN; END IF;
 SELECT au.id, au.role::text INTO v_admin_id,v_role FROM public.admin_users au WHERE au.user_id=(SELECT auth.uid()) AND au.is_active=true AND au.archived_at IS NULL LIMIT 1;
 IF v_admin_id IS NULL THEN RETURN; END IF;
 IF v_role NOT IN ('sales','sales_lead') THEN
  RETURN QUERY SELECT * FROM public.search_import_leads_unrestricted(p_term,least(greatest(coalesce(p_limit,25),1),50));
  RETURN;
 END IF;
 IF length(v_raw)<2 THEN RETURN; END IF;
 v_compact := upper(regexp_replace(v_raw,'[^A-Za-z0-9]','','g'));
 v_spaced := CASE WHEN length(v_compact)>=5 THEN left(v_compact,length(v_compact)-3)||' '||right(v_compact,3) ELSE v_compact END;
 v_digits := regexp_replace(v_raw,'\D','','g');
 v_tail9 := CASE WHEN length(v_digits)>=7 THEN right(v_digits,9) ELSE NULL END;
 v_frag := CASE WHEN length(v_digits)>=5 THEN CASE WHEN left(v_digits,2)='44' AND length(v_digits)>=11 THEN '0'||substring(v_digits FROM 3) ELSE v_digits END ELSE NULL END;
 RETURN QUERY
 SELECT 'lead'::text,sl.id::text,sl.first_name,sl.last_name,sl.email,sl.phone,sl.vehicle_reg,sl.vehicle_make,sl.vehicle_model,sl.vehicle_year,sl.mileage,sl.plan_interest,sl.assigned_to,sl.created_at
 FROM public.sales_leads sl
 WHERE sl.assigned_to=v_admin_id AND (
  sl.first_name ILIKE '%'||v_raw||'%' OR sl.last_name ILIKE '%'||v_raw||'%' OR sl.email ILIKE '%'||v_raw||'%'
  OR sl.vehicle_reg ILIKE '%'||v_compact||'%' OR sl.vehicle_reg ILIKE '%'||v_spaced||'%'
  OR (v_tail9 IS NOT NULL AND right(public.normalize_uk_phone(sl.phone),9)=v_tail9)
  OR (v_frag IS NOT NULL AND public.normalize_uk_phone(sl.phone) LIKE '%'||v_frag||'%'))
 ORDER BY sl.created_at DESC LIMIT least(greatest(coalesce(p_limit,25),1),50);
END; $$;
REVOKE ALL ON FUNCTION public.search_import_leads(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_import_leads(text,integer) TO authenticated,service_role;

CREATE FUNCTION public.can_import_quote_lead(p_lead_id uuid, p_viewer_admin_id uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_admin_id uuid; v_role text;
BEGIN
 IF NOT public.is_active_admin_user((SELECT auth.uid())) THEN RETURN false; END IF;
 SELECT au.id,au.role::text INTO v_admin_id,v_role FROM public.admin_users au WHERE au.user_id=(SELECT auth.uid()) AND au.is_active=true AND au.archived_at IS NULL LIMIT 1;
 IF v_admin_id IS NULL THEN RETURN false; END IF;
 IF p_viewer_admin_id IS NOT NULL AND p_viewer_admin_id IS DISTINCT FROM v_admin_id THEN
  IF v_role <> 'super_admin' THEN RETURN false; END IF;
  SELECT au.id,au.role::text INTO v_admin_id,v_role FROM public.admin_users au WHERE au.id=p_viewer_admin_id AND au.is_active=true AND au.archived_at IS NULL;
  IF v_admin_id IS NULL THEN RETURN false; END IF;
 END IF;
 RETURN EXISTS(SELECT 1 FROM public.sales_leads sl WHERE sl.id=p_lead_id AND (v_role NOT IN ('sales','sales_lead') OR sl.assigned_to=v_admin_id));
END; $$;
REVOKE ALL ON FUNCTION public.can_import_quote_lead(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_import_quote_lead(uuid,uuid) TO authenticated,service_role;