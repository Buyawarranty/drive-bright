CREATE OR REPLACE FUNCTION public.sync_owner_from_lead_on_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm_email text := lower(trim(coalesce(NEW.email, '')));
  norm_reg   text := upper(regexp_replace(coalesce(NEW.registration_plate, ''), '\s+', '', 'g'));
  lead_owner uuid;
  v_src text := lower(coalesce(NEW.acquisition_source, ''));
BEGIN
  IF coalesce(NEW.is_deleted, false) = true
     OR lower(coalesce(NEW.status, '')) IN ('cancelled', 'refunded') THEN
    RETURN NEW;
  END IF;

  -- Online self-serve sale (customer bought on the website themselves):
  -- credit stays with Website, never the agent who worked the earlier enquiry.
  IF coalesce(NEW.is_manual_entry, false) = false
     AND (v_src IN ('website', 'direct', 'google_ads', 'facebook_ads', 'bing_ad', 'bing_ads', 'social_ad', 'google_ad')
          OR coalesce(NEW.gclid, '') <> '') THEN
    NEW.assigned_to := NULL;
    RETURN NEW;
  END IF;

  IF norm_email = '' AND norm_reg = '' THEN
    RETURN NEW;
  END IF;

  SELECT sl.assigned_to INTO lead_owner
  FROM public.sales_leads sl
  WHERE sl.assigned_to IS NOT NULL
    AND sl.status <> 'fake_lead'::lead_status
    AND (
      (norm_email <> '' AND lower(trim(sl.email)) = norm_email)
      OR (norm_reg <> '' AND upper(regexp_replace(coalesce(sl.vehicle_reg, ''), '\s+', '', 'g')) = norm_reg)
    )
  ORDER BY sl.created_at ASC
  LIMIT 1;

  IF lead_owner IS NOT NULL THEN
    NEW.assigned_to := lead_owner;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.customers
   SET assigned_to = NULL
 WHERE coalesce(is_deleted, false) = false
   AND coalesce(is_manual_entry, false) = false
   AND assigned_to IS NOT NULL
   AND (lower(coalesce(acquisition_source, '')) IN ('website','direct','google_ads','facebook_ads','bing_ad','bing_ads','social_ad','google_ad')
        OR coalesce(gclid, '') <> '');