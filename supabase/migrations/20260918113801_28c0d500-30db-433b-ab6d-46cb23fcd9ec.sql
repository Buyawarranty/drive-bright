CREATE OR REPLACE FUNCTION public.sync_sibling_lead_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     AND NEW.assigned_to IS NOT NULL
     AND NEW.owner_agent IS NOT NULL
     AND NEW.assigned_to = NEW.owner_agent THEN
    UPDATE public.sales_leads sibling
       SET assigned_to = NEW.assigned_to,
           owner_agent = NEW.owner_agent,
           assigned_at = COALESCE(sibling.assigned_at, NEW.assigned_at, now()),
           updated_at = now()
     WHERE sibling.id <> NEW.id
       AND sibling.status NOT IN ('converted','lost','fake_lead','not_interested','do_not_contact','not_eligible','unsubscribed')
       AND (
         (NULLIF(lower(btrim(sibling.email)),'') IS NOT NULL AND lower(btrim(sibling.email)) = lower(btrim(NEW.email)))
         OR
         (length(regexp_replace(COALESCE(sibling.phone,''),'\D','','g')) >= 9
          AND right(regexp_replace(COALESCE(sibling.phone,''),'\D','','g'),9) = right(regexp_replace(COALESCE(NEW.phone,''),'\D','','g'),9))
       );
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.sync_sibling_lead_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_sibling_lead_owner() TO service_role;