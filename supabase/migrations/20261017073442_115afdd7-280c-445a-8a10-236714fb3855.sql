CREATE OR REPLACE FUNCTION public.abandoned_cart_contact_keys(p_email text, p_phone text, p_reg text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT array_remove(ARRAY[
 CASE WHEN nullif(btrim(p_email),'') IS NOT NULL THEN 'email:' || lower(btrim(p_email)) END,
 CASE WHEN length(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')) >= 10 THEN 'phone:' || right(regexp_replace(p_phone,'[^0-9]','','g'),9) END,
 CASE WHEN nullif(regexp_replace(upper(coalesce(p_reg,'')),'[^A-Z0-9]','','g'),'') IS NOT NULL THEN 'reg:' || regexp_replace(upper(p_reg),'[^A-Z0-9]','','g') END
 ],NULL);
$$;
REVOKE ALL ON FUNCTION public.abandoned_cart_contact_keys(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.abandoned_cart_contact_keys(text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_excluded_abandoned_cart_ids(p_cart_ids uuid[])
RETURNS TABLE(id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT coalesce(public.is_active_admin_user(auth.uid()),false) THEN
   RAISE EXCEPTION 'Active staff access required' USING ERRCODE = '42501';
 END IF;
 IF cardinality(p_cart_ids) > 1000 THEN RAISE EXCEPTION 'Maximum 1000 carts per check'; END IF;
 RETURN QUERY
 WITH history AS MATERIALIZED (
   SELECT c.email, c.phone, c.registration_plate AS reg FROM public.customers c
   UNION ALL SELECT p.email, NULL::text, NULL::text FROM public.customer_policies p
   UNION ALL SELECT c.email, c.phone, c.vehicle_registration FROM public.claims_submissions c
   UNION ALL SELECT q.customer_email, NULL::text, q.vehicle_reg FROM public.admin_sent_quotes q WHERE q.customer_purchased = true
   UNION ALL SELECT b.customer_data->>'email', b.customer_data->>'phone', coalesce(b.customer_data->>'vehicle_reg', b.vehicle_data->>'regNumber') FROM public.bumper_transactions b WHERE lower(b.status) IN ('completed','paid','success','refunded','cancelled')
   UNION ALL SELECT p.customer_email,p.customer_phone,NULL::text FROM public.payment_assist_transactions p WHERE lower(p.status) IN ('completed','paid','success','funded','refunded')
 ), blocked_keys AS MATERIALIZED (
   SELECT DISTINCT unnest(public.abandoned_cart_contact_keys(h.email,h.phone,h.reg)) AS contact_key FROM history h
 ), candidates AS MATERIALIZED (
   SELECT a.* FROM public.abandoned_carts a WHERE a.id = ANY(p_cart_ids)
 ), matched AS (
   SELECT DISTINCT a.id FROM candidates a
   CROSS JOIN LATERAL unnest(public.abandoned_cart_contact_keys(a.email,a.phone,a.vehicle_reg)) k(contact_key)
   JOIN blocked_keys b USING (contact_key)
 )
 SELECT a.id FROM candidates a
 WHERE coalesce(a.is_converted,false) OR a.converted_at IS NOT NULL
   OR lower(btrim(coalesce(a.contact_status,''))) IN ('converted','purchased','cancelled','canceled','refunded','claim','claimed')
   OR EXISTS (SELECT 1 FROM matched m WHERE m.id=a.id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_excluded_abandoned_cart_ids(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_excluded_abandoned_cart_ids(uuid[]) TO authenticated, service_role;